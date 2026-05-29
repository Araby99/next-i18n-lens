import { decodeKey, stripWatermark } from './watermark.js';

const ZW_RE = /[\u200B\u200C\u200D]/g;

export class DOMInterceptor {
  private onElementSelected: (payload: { key: string; fallbackValue: string; currentValue: string }) => void;
  private hoveredElement: HTMLElement | null = null;
  private originalOutline: string = '';
  private originalCursor: string = '';
  private observer: MutationObserver | null = null;
  private inputSanitizersAttached: boolean = false;

  constructor(
    onElementSelected: (payload: { key: string; fallbackValue: string; currentValue: string }) => void
  ) {
    this.onElementSelected = onElementSelected;
  }

  /**
   * Initializes the DOM event interceptors in development mode.
   * Also launches the watermark scanner and MutationObserver.
   */
  init(): void {
    // RULE CLT-004: INIT GUARD
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    // Attach listeners on window capture phase (RULE CLT-002)
    window.addEventListener('mouseover', this.handleMouseOver, true);
    window.addEventListener('mouseout', this.handleMouseOut, true);
    window.addEventListener('click', this.handleClick, true);
    window.addEventListener('copy', this.handleCopy, true);
    window.addEventListener('paste', this.handlePaste, true);

    // Phase 3: Scan existing DOM for watermarked text nodes
    this.scanSubtree(document.body);

    // Phase 3: Observe future DOM mutations for watermarked nodes
    this.attachMutationObserver();

    // Phase 3: Sanitize form inputs/submissions to strip ZW chars
    this.attachInputSanitizers();
  }

  /**
   * Cleans up all attached event listeners, the MutationObserver,
   * and the form-sanitization listeners.
   */
  destroy(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener('mouseover', this.handleMouseOver, true);
    window.removeEventListener('mouseout', this.handleMouseOut, true);
    window.removeEventListener('click', this.handleClick, true);
    window.removeEventListener('copy', this.handleCopy, true);
    window.removeEventListener('paste', this.handlePaste, true);
    window.removeEventListener('beforeinput', this.handleBeforeInput, true);

    // Detach form-submit sanitizer
    document.removeEventListener('submit', this.handleFormSubmit, true);

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.inputSanitizersAttached = false;

    if (this.hoveredElement) {
      this.clearHighlight(this.hoveredElement);
      this.hoveredElement = null;
    }
  }

  // ─── Phase 3: Watermark DOM Scanner ──────────────────────────────────────

  /**
   * Walks all text nodes inside `root` and decodes any watermark prefix.
   * When found, attaches data-i18n-key / data-i18n-template to the
   * immediate parent HTMLElement without mutating the text node itself
   * (hydration safety: RULE CLT-007).
   */
  private scanSubtree(root: Node): void {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

    let node: Text | null;
    while ((node = walker.nextNode() as Text | null) !== null) {
      this.processTextNode(node);
    }
  }

  private processTextNode(node: Text): void {
    const raw = node.nodeValue ?? '';
    if (!raw.includes('\u200D')) return; // fast bail-out

    const decoded = decodeKey(raw);
    if (!decoded) return;

    const parent = node.parentElement;
    if (!parent) return;

    // RULE CLT-007: Do NOT strip the ZW chars from the text node –
    // doing so would break React's reconciliation / hydration tree.
    // Only annotate the parent element.
    parent.setAttribute('data-i18n-key', decoded.key);

    // Use the clean (visible) text as the fallback template if not already set
    if (!parent.hasAttribute('data-i18n-template')) {
      parent.setAttribute('data-i18n-template', decoded.cleanText.trim());
    }
  }

  /**
   * Attaches a MutationObserver to catch newly rendered / streamed elements.
   */
  private attachMutationObserver(): void {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const added of mutation.addedNodes) {
            if (added.nodeType === Node.ELEMENT_NODE) {
              this.scanSubtree(added);
            } else if (added.nodeType === Node.TEXT_NODE) {
              this.processTextNode(added as Text);
            }
          }
        } else if (mutation.type === 'characterData') {
          if (mutation.target.nodeType === Node.TEXT_NODE) {
            this.processTextNode(mutation.target as Text);
          }
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  // ─── Phase 3: Input & Form Sanitization ──────────────────────────────────

  /**
   * Patches input value descriptors and attaches a form submit listener
   * to strip zero-width watermark characters before any data leaves the
   * browser (preventing backend schema validation rejections or storage
   * of invisible chars).
   */
  private attachInputSanitizers(): void {
    if (this.inputSanitizersAttached) return;
    this.inputSanitizersAttached = true;

    // Capture form submissions at the document level
    document.addEventListener('submit', this.handleFormSubmit, true);

    // Intercept `beforeinput` for direct keyboard input into inputs/textareas
    window.addEventListener('beforeinput', this.handleBeforeInput, true);

    // Patch HTMLInputElement.prototype.value getter/setter
    this.patchInputValueDescriptor(HTMLInputElement.prototype);
    this.patchInputValueDescriptor(HTMLTextAreaElement.prototype);
  }

  /**
   * Patches the `value` property descriptor of an input prototype so
   * that reads return sanitized strings even if the user somehow pastes
   * watermark characters.
   */
  private patchInputValueDescriptor(proto: HTMLInputElement | HTMLTextAreaElement): void {
    const original = Object.getOwnPropertyDescriptor(proto, 'value');
    if (!original || !original.get || !original.set) return;

    // Prevent double-patching
    if ((proto as any).__i18nLensSanitized__) return;
    (proto as any).__i18nLensSanitized__ = true;

    Object.defineProperty(proto, 'value', {
      get() {
        const raw: string = original.get!.call(this);
        return raw.replace(ZW_RE, '');
      },
      set(val: string) {
        const clean = typeof val === 'string' ? val.replace(ZW_RE, '') : val;
        original.set!.call(this, clean);
      },
      configurable: true,
    });
  }

  private handleFormSubmit = (event: Event): void => {
    const form = event.target as HTMLFormElement | null;
    if (!form) return;

    const inputs = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input, textarea'
    );
    inputs.forEach((input) => {
      const cleaned = input.value.replace(ZW_RE, '');
      if (cleaned !== input.value) {
        // Use the original setter to set the cleaned value directly
        const proto =
          input instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor?.set) {
          descriptor.set.call(input, cleaned);
        }
      }
    });
  };

  private handleBeforeInput = (_event: InputEvent): void => {
    // No-op: direct keyboard input doesn't contain ZW characters.
    // This listener is reserved for future clipboard paste interception.
  };

  // ─── Mouse / Click Handlers ───────────────────────────────────────────────

  private handleMouseOver = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;

    const keyedElement = target.closest('[data-i18n-key]') as HTMLElement | null;
    if (!keyedElement) return;

    // RULE CLT-003: ALWAYS CHECK data-i18n-key EXISTENCE
    const key = keyedElement.getAttribute('data-i18n-key');
    if (key === null) {
      return;
    }

    if (this.hoveredElement && this.hoveredElement !== keyedElement) {
      this.clearHighlight(this.hoveredElement);
    }

    this.hoveredElement = keyedElement;
    this.originalOutline = keyedElement.style.outline;
    this.originalCursor = keyedElement.style.cursor;

    // RULE CLT-001: DOM OPERATIONS ARE SIDE-EFFECT-FREE
    keyedElement.style.outline = '2px dashed #3b82f6';
    keyedElement.style.cursor = 'pointer';
  };

  private handleMouseOut = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;

    const keyedElement = target.closest('[data-i18n-key]') as HTMLElement | null;
    if (!keyedElement || keyedElement !== this.hoveredElement) return;

    this.clearHighlight(keyedElement);
    this.hoveredElement = null;
  };

  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;

    const keyedElement = target.closest('[data-i18n-key]') as HTMLElement | null;
    if (!keyedElement) return;

    // RULE CLT-003: ALWAYS CHECK data-i18n-key EXISTENCE
    const key = keyedElement.getAttribute('data-i18n-key');
    if (key === null) {
      return;
    }

    // RULE CLT-002: EVENT LISTENERS IN CAPTURE PHASE
    event.preventDefault();
    event.stopPropagation();

    // Use innerText, stripping any invisible ZW chars before sending to studio
    const rawText = keyedElement.innerText || '';
    const cleanText = stripWatermark(rawText);

    const fallbackValue = keyedElement.getAttribute('data-i18n-template') || cleanText;
    const currentValue = cleanText;

    this.onElementSelected({
      key,
      fallbackValue,
      currentValue,
    });
  };

  private handleCopy = (event: ClipboardEvent): void => {
    const selection = window.getSelection()?.toString() || '';
    if (selection.includes('\u200D') || selection.includes('\u200B') || selection.includes('\u200C')) {
      const clean = selection.replace(ZW_RE, '');
      event.clipboardData?.setData('text/plain', clean);
      event.preventDefault();
    }
  };

  private handlePaste = (event: ClipboardEvent): void => {
    const text = event.clipboardData?.getData('text/plain') || '';
    if (text.includes('\u200D') || text.includes('\u200B') || text.includes('\u200C')) {
      event.preventDefault();
      const cleaned = text.replace(ZW_RE, '');
      const targetInput = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (targetInput && ('value' in targetInput)) {
        const proto = targetInput instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        
        if (nativeValueSetter) {
          const start = targetInput.selectionStart || 0;
          const end = targetInput.selectionEnd || 0;
          const val = targetInput.value;
          const cleanedValue = val.slice(0, start) + cleaned + val.slice(end);
          
          nativeValueSetter.call(targetInput, cleanedValue);
          targetInput.selectionStart = targetInput.selectionEnd = start + cleaned.length;
          
          // Dispatch bubbling input event so React virtual DOM state syncs
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  };

  private clearHighlight(element: HTMLElement): void {
    // Revert outline and cursor styles to original values
    element.style.outline = this.originalOutline;
    element.style.cursor = this.originalCursor;
  }
}
