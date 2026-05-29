import React, { useState } from 'react';
import { SelectedElement } from '../types/index.js';

interface EditorPanelProps {
  selected: SelectedElement | null;
  inputValue: string;
  locale: string;
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onLocaleChange: (locale: string) => void;
  onSave: () => Promise<void>;
  onClear: () => void;
  locales: string[];
  onAddLocale: (newLocale: string) => Promise<void>;
  onRenameLocale: (oldLocale: string, newLocale: string) => Promise<void>;
  onDeleteLocale: (locale: string) => Promise<void>;
}

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  zh: 'Chinese',
  ja: 'Japanese',
  pt: 'Portuguese',
  it: 'Italian',
  ru: 'Russian',
  hi: 'Hindi',
  tr: 'Turkish',
};

const getLocaleLabel = (code: string) => {
  const base = code.split('-')[0]?.toLowerCase() || code;
  const name = LOCALE_NAMES[base] || LOCALE_NAMES[code] || 'Custom';
  return `${name} (${code})`;
};

export const EditorPanel = ({
  selected,
  inputValue,
  locale,
  isLoading,
  isSuccess,
  error,
  onInputChange,
  onLocaleChange,
  onSave,
  onClear,
  locales,
  onAddLocale,
  onRenameLocale,
  onDeleteLocale,
}: EditorPanelProps) => {
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [newLocaleCode, setNewLocaleCode] = useState('');
  const [editingLocale, setEditingLocale] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingLocale, setDeletingLocale] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const code = newLocaleCode.trim();
    const LOCALE_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/;

    if (!code) return;
    if (!LOCALE_RE.test(code)) {
      setLocalError(
        'Locale format must be 2-3 letters, optionally followed by a region (e.g., fr or es-MX).'
      );
      return;
    }
    if (locales.includes(code)) {
      setLocalError('Locale already exists.');
      return;
    }

    try {
      await onAddLocale(code);
      setNewLocaleCode('');
    } catch (err: any) {
      setLocalError(err.message || 'Failed to add locale.');
    }
  };

  const handleStartRename = (code: string) => {
    setEditingLocale(code);
    setRenameValue(code);
    setLocalError(null);
  };

  const handleRenameSave = async (oldCode: string) => {
    setLocalError(null);
    const code = renameValue.trim();
    const LOCALE_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/;

    if (!code || code === oldCode) {
      setEditingLocale(null);
      return;
    }
    if (!LOCALE_RE.test(code)) {
      setLocalError('Invalid locale format.');
      return;
    }
    if (locales.includes(code) && code !== oldCode) {
      setLocalError('Target locale already exists.');
      return;
    }

    try {
      await onRenameLocale(oldCode, code);
      setEditingLocale(null);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to rename.');
    }
  };

  const handleDeleteConfirm = async (code: string) => {
    setLocalError(null);
    try {
      await onDeleteLocale(code);
      setDeletingLocale(null);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to delete.');
    }
  };

  return (
    <div className="w-[420px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full shadow-2xl overflow-hidden shrink-0">
      {/* Panel Header */}
      <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 select-none">
        <h2 className="text-sm font-bold tracking-wide font-outfit text-slate-200">
          {isManageOpen ? 'Manage Languages' : 'Translation Studio'}
        </h2>

        {/* Language select & Manage toggler */}
        <div className="flex items-center gap-2">
          {!isManageOpen && (
            <>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Locale
              </label>
              <select
                value={locale}
                onChange={(e) => onLocaleChange(e.target.value)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer font-mono"
              >
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {getLocaleLabel(l)}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            onClick={() => {
              setIsManageOpen(!isManageOpen);
              setLocalError(null);
            }}
            className={`p-1.5 rounded-lg border transition duration-200 ${
              isManageOpen
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
            title={isManageOpen ? 'Back to Editor' : 'Manage Languages'}
          >
            {isManageOpen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Editor Body or Language Manager Body */}
      {isManageOpen ? (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
          {/* Add language form */}
          <form onSubmit={handleAdd} className="space-y-2.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Add New Locale
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLocaleCode}
                onChange={(e) => setNewLocaleCode(e.target.value)}
                placeholder="e.g. fr, es-MX"
                disabled={isLoading}
                className="flex-1 min-w-0 bg-slate-950 border border-slate-800 hover:border-slate-750 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-600 font-mono transition duration-155"
              />
              <button
                type="submit"
                disabled={isLoading || !newLocaleCode.trim()}
                className="h-10 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-xl transition duration-155 flex items-center justify-center gap-1.5 shrink-0"
              >
                Add
              </button>
            </div>
          </form>

          {/* Errors display */}
          {(localError || error) && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5 shadow-sm">
              <svg
                className="w-4 h-4 text-rose-500 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-xs text-rose-400 font-mono leading-normal break-all">
                {localError || error}
              </div>
            </div>
          )}

          {/* Languages list */}
          <div className="flex-1 flex flex-col space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Active Locales
            </label>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-none">
              {locales.map((l) => (
                <div
                  key={l}
                  className="bg-slate-950/40 border border-slate-850 hover:border-slate-800/80 rounded-xl px-4 py-3 flex items-center justify-between gap-4 transition duration-200"
                >
                  {editingLocale === l ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        disabled={isLoading}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRenameSave(l)}
                        disabled={isLoading}
                        className="p-1 text-emerald-400 hover:text-emerald-300 transition duration-150"
                        title="Save rename"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setEditingLocale(null)}
                        disabled={isLoading}
                        className="p-1 text-slate-500 hover:text-slate-400 transition duration-150"
                        title="Cancel"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ) : deletingLocale === l ? (
                    <div className="flex-1 flex flex-col gap-2">
                      <span className="text-[10px] font-semibold text-rose-400">
                        Confirm deletion? This deletes the translation file.
                      </span>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setDeletingLocale(null)}
                          disabled={isLoading}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleDeleteConfirm(l)}
                          disabled={isLoading}
                          className="px-2.5 py-1 text-[10px] font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition shadow-md shadow-rose-600/10"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {getLocaleLabel(l)}
                        </span>
                        {l === locale && (
                          <span className="text-[9px] text-indigo-400 font-bold tracking-wide mt-0.5">
                            ACTIVE WORKSPACE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartRename(l)}
                          disabled={isLoading}
                          className="p-1.5 text-slate-500 hover:text-slate-300 transition duration-150"
                          title="Rename locale code"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingLocale(l)}
                          disabled={isLoading}
                          className="p-1.5 text-slate-500 hover:text-rose-400 transition duration-150"
                          title="Delete locale"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : selected ? (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
          {/* Key Path Info (RULE STD-003: Read-only display) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Translation Key
              </label>
              <button
                onClick={onClear}
                className="text-[10px] font-medium text-slate-500 hover:text-slate-300 transition duration-200"
              >
                Clear Selection
              </button>
            </div>
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-3 font-mono text-xs text-indigo-400 select-all break-all shadow-inner leading-relaxed">
              {selected.key}
            </div>
          </div>

          {/* Fallback Reference */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Reference (Fallback Value)
            </label>
            <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-400 select-all leading-relaxed whitespace-pre-wrap">
              {selected.fallbackValue || <span className="italic text-slate-600">None</span>}
            </div>
          </div>

          {/* Edit Area */}
          <div className="space-y-2 flex-1 flex flex-col min-h-[180px]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Translation Output
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {inputValue.length}/10000
              </span>
            </div>
            <textarea
              id="studio-translation-input"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              disabled={isLoading}
              placeholder="Type your translation here..."
              className="flex-1 w-full bg-slate-950 border border-slate-800 hover:border-slate-750 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-600 font-sans resize-none transition duration-205 shadow-inner leading-relaxed"
            />
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5 shadow-sm">
              <svg
                className="w-4 h-4 text-rose-500 shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-xs text-rose-400 font-mono leading-normal break-all">
                {error}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-4 shrink-0">
            <button
              id="studio-save-button"
              onClick={onSave}
              disabled={isLoading || inputValue === selected.currentValue}
              className={`flex-1 h-11 rounded-xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg transition duration-205 ${
                inputValue === selected.currentValue
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none border border-slate-850'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white active:bg-indigo-700'
              }`}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-indigo-200"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : isSuccess ? (
                <span
                  data-testid="save-success"
                  className="flex items-center gap-1 text-emerald-400 font-bold"
                >
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Saved!</span>
                </span>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-sm mb-6">
            <svg
              className="w-8 h-8 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
              />
            </svg>
          </div>
          <h3 className="text-slate-200 font-semibold tracking-wide font-outfit">
            Select an Element
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mt-2 leading-relaxed">
            Hover over elements in the live preview iframe and click to load them into the visual
            editing sidebar.
          </p>
        </div>
      )}
    </div>
  );
};
