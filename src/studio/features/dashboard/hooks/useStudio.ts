import { useState, useEffect, useRef, useCallback } from 'react';
import { SelectedElement, ConnectionStatus } from '../types/index.js';

const APP_ORIGIN = (import.meta as any).env?.VITE_APP_ORIGIN || 'http://localhost:3000';

// Helper to flatten nested JSON objects to dot-separated keys
function flattenObject(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  if (!obj || typeof obj !== 'object') return result;
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(result, flattenObject(obj[key], newKey));
      } else {
        result[newKey] = String(obj[key]);
      }
    }
  }
  return result;
}

export const useStudio = () => {
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [locale, setLocale] = useState<string>('en');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('/');

  // Phase 2: Full locale keys searchable state
  const [localeData, setLocaleData] = useState<Record<string, string>>({});
  const [enLocaleData, setEnLocaleData] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Feature 2: Active page key filtering — null means "show all"
  const [visibleKeys, setVisibleKeys] = useState<string[] | null>(null);

  // Custom Confirmation Modal States (Keeping hook UI-agnostic)
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [pendingElement, setPendingElement] = useState<SelectedElement | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Check if there are unsaved changes
  const hasUnsavedChanges = selected !== null && inputValue !== selected.currentValue;

  // Fetch full dictionary for active locale (Phase 2)
  const fetchLocaleData = useCallback(async (targetLocale: string) => {
    try {
      const response = await fetch(`${APP_ORIGIN}/api/i18n-lens/mutate?locale=${targetLocale}`);
      if (!response.ok) {
        throw new Error(`Failed to load locale dictionary: ${response.statusText}`);
      }
      const data = await response.json();
      setLocaleData(flattenObject(data));
    } catch (err: any) {
      // Don't block studio UI if fetch fails
      console.warn('[i18n-lens] Failed to load full locale dictionary:', err.message);
    }
  }, []);

  // Fetch locale data when connection is successful or when locale changes
  useEffect(() => {
    if (connectionStatus === 'connected') {
      fetchLocaleData(locale);
    }
  }, [connectionStatus, locale, fetchLocaleData]);

  // Fetch English reference data once connected
  useEffect(() => {
    if (connectionStatus === 'connected') {
      fetch(`${APP_ORIGIN}/api/i18n-lens/mutate?locale=en`)
        .then(res => res.json())
        .then(data => setEnLocaleData(flattenObject(data)))
        .catch(err => console.warn('[i18n-lens] Failed to load reference English locale:', err.message));
    }
  }, [connectionStatus]);

  // Keep English reference in sync if the active locale is English and gets updated
  useEffect(() => {
    if (locale === 'en') {
      setEnLocaleData(localeData);
    }
  }, [locale, localeData]);

  // Sync active translation value and English reference when active locale changes
  useEffect(() => {
    if (selected) {
      const activeValue = localeData[selected.key] || '';
      const enValue = enLocaleData[selected.key] || selected.fallbackValue || '';
      
      // Only update if value in localeData is different, to avoid overwriting ongoing typing
      if (selected.currentValue !== activeValue) {
        setSelected(prev => prev ? {
          ...prev,
          currentValue: activeValue,
          fallbackValue: enValue
        } : null);
        setInputValue(activeValue);
      }
    }
  }, [localeData, enLocaleData]);

  // Set the locale inside state and URL query parameter if required
  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale);
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        const url = new URL(iframeRef.current.src);
        url.searchParams.set('locale', newLocale);
        iframeRef.current.src = url.toString();
      } catch (e) {}
    }
  };

  // Helper to send message to iframe
  const sendToIframe = useCallback((type: string, payload?: any) => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { source: 'i18n-lens-studio', type, payload },
        APP_ORIGIN
      );
    }
  }, []);

  // Update input value with live preview message back to iframe
  const handleInputChange = (value: string) => {
    setInputValue(value);
    sendToIframe('APPLY_PREVIEW', { key: selected?.key, value });
  };

  const selectElement = useCallback((newElement: SelectedElement) => {
    // Expose the custom Confirmation Modal state instead of using blocking window.confirm (RULE STD-004)
    if (hasUnsavedChanges) {
      setPendingElement(newElement);
      setShowConfirmModal(true);
      return;
    }

    const rawValue = localeData[newElement.key] !== undefined ? localeData[newElement.key] : newElement.currentValue;

    setSelected({
      ...newElement,
      currentValue: rawValue,
    });
    setInputValue(rawValue);
    setIsSuccess(false);
    setError(null);
  }, [hasUnsavedChanges, localeData]);

  // Expose trigger actions to handle Confirmation Modal choice
  const confirmDiscard = () => {
    if (pendingElement) {
      const rawValue = localeData[pendingElement.key] !== undefined ? localeData[pendingElement.key] : pendingElement.currentValue;
      setSelected({
        ...pendingElement,
        currentValue: rawValue,
      });
      setInputValue(rawValue);
      setPendingElement(null);
    }
    setShowConfirmModal(false);
    setIsSuccess(false);
    setError(null);
  };

  const cancelDiscard = () => {
    setPendingElement(null);
    setShowConfirmModal(false);
  };

  // Select a key directly from the searchable sidebar directory (Phase 2)
  const selectKeyDirectly = (key: string) => {
    const value = localeData[key] || '';
    selectElement({
      key,
      fallbackValue: value,
      currentValue: value,
    });
  };

  // Handle postMessage events from the embedded client iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate incoming message origin
      if (event.origin !== APP_ORIGIN) {
        return;
      }

      if (event.data?.source !== 'i18n-lens-client') {
        return;
      }

      const { type, payload } = event.data;

      if (type === 'READY') {
        setConnectionStatus('connected');
        setCurrentPath(payload.url || '/');
        // Reset visible keys on page navigation so the sidebar shows all keys briefly
        setVisibleKeys(null);
        // Extract locale if embedded in URL path or query params
        try {
          const urlObj = new URL(payload.url, APP_ORIGIN);
          const qLocale = urlObj.searchParams.get('locale');
          if (qLocale) {
            setLocale(qLocale);
          } else {
            const segments = urlObj.pathname.split('/');
            const possibleLocale = segments[1];
            if (possibleLocale && possibleLocale.length === 2) {
              setLocale(possibleLocale);
            }
          }
        } catch (e) {}
      } else if (type === 'ELEMENT_SELECTED') {
        selectElement(payload);
      } else if (type === 'ERROR') {
        setError(payload.error || 'Client-side error occurred.');
      } else if (type === 'VISIBLE_KEYS_CHANGED') {
        // payload is a string[] of translation keys visible on the current page
        if (Array.isArray(payload)) {
          setVisibleKeys(payload as string[]);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [selectElement]);

  // Save mutation to Server Handler
  const handleSave = async () => {
    if (!selected) return;

    setIsLoading(true);
    setIsSuccess(false);
    setError(null);

    try {
      const response = await fetch(`${APP_ORIGIN}/api/i18n-lens/mutate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale,
          key: selected.key,
          value: inputValue,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Server responded with status ${response.status}`);
      }

      // Successful save
      setIsSuccess(true);
      setSelected((prev) => prev ? { ...prev, currentValue: inputValue } : null);
      
      // Update dictionary state local cache
      setLocaleData((prev) => ({
        ...prev,
        [selected.key]: inputValue,
      }));

      // Send indicator update back to client to clear selection highlight
      sendToIframe('CLEAR_SELECTION');

      // Clear saved indicator after 2 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save translation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSelection = () => {
    setSelected(null);
    setInputValue('');
    sendToIframe('CLEAR_SELECTION');
  };

  // Filter dictionary keys based on search input (Phase 2)
  // Also filter by visible page keys (Feature 2) when the iframe has reported them.
  const filteredKeys = Object.keys(localeData).filter((key) => {
    // Contextual filter: only show keys present on the current page
    if (visibleKeys !== null && !visibleKeys.includes(key)) {
      return false;
    }
    const val = localeData[key] || '';
    return (
      key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      val.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Feature 3: Translation coverage — percentage of enLocaleData keys that have
  // a non-empty value in the current locale.
  const totalKeys = Object.keys(enLocaleData).length;
  const translatedKeys = Object.keys(enLocaleData).filter((key) => {
    const val = localeData[key];
    return val !== undefined && val.trim() !== '';
  }).length;
  const coveragePercentage = totalKeys > 0 ? Math.round((translatedKeys / totalKeys) * 100) : 100;

  return {
    selected,
    inputValue,
    locale,
    connectionStatus,
    isLoading,
    isSuccess,
    error,
    currentPath,
    iframeRef,
    appOrigin: APP_ORIGIN,
    showConfirmModal,
    localeData,
    searchTerm,
    filteredKeys,
    coveragePercentage,
    setSearchTerm,
    selectKeyDirectly,
    handleInputChange,
    handleLocaleChange,
    handleSave,
    handleClearSelection,
    confirmDiscard,
    cancelDiscard,
  };
};
