import React from 'react';
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
}

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
}: EditorPanelProps) => {
  return (
    <div className="w-[420px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full shadow-2xl overflow-hidden shrink-0">
      {/* Panel Header */}
      <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 select-none">
        <h2 className="text-sm font-bold tracking-wide font-outfit text-slate-200">Translation Studio</h2>
        
        {/* Language select */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Locale</label>
          <select
            value={locale}
            onChange={(e) => onLocaleChange(e.target.value)}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer font-mono"
          >
            <option value="en">English (en)</option>
            <option value="ar">Arabic (ar)</option>
            <option value="es">Spanish (es)</option>
            <option value="fr">French (fr)</option>
            <option value="de">German (de)</option>
          </select>
        </div>
      </div>

      {/* Editor Body */}
      {selected ? (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
          {/* Key Path Info (RULE STD-003: Read-only display) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Translation Key</label>
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
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Reference (Fallback Value)</label>
            <div className="bg-slate-950/40 border border-slate-850 rounded-xl px-4 py-3 text-sm text-slate-400 select-all leading-relaxed whitespace-pre-wrap">
              {selected.fallbackValue || <span className="italic text-slate-600">None</span>}
            </div>
          </div>

          {/* Edit Area */}
          <div className="space-y-2 flex-1 flex flex-col min-h-[180px]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Translation Output</label>
              <span className="text-[10px] text-slate-500 font-mono">{inputValue.length}/10000</span>
            </div>
            <textarea
              id="studio-translation-input"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              disabled={isLoading}
              placeholder="Type your translation here..."
              className="flex-1 w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 rounded-xl p-4 text-sm text-slate-100 placeholder-slate-600 font-sans resize-none transition duration-200 shadow-inner leading-relaxed"
            />
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2.5 shadow-sm">
              <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
              className={`flex-1 h-11 rounded-xl text-sm font-semibold tracking-wide flex items-center justify-center gap-2 shadow-lg transition duration-200 ${
                inputValue === selected.currentValue
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none border border-slate-850'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white active:bg-indigo-700'
              }`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-indigo-200" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : isSuccess ? (
                <span data-testid="save-success" className="flex items-center gap-1 text-emerald-400 font-bold">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
            <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          </div>
          <h3 className="text-slate-200 font-semibold tracking-wide font-outfit">Select an Element</h3>
          <p className="text-xs text-slate-500 max-w-xs mt-2 leading-relaxed">
            Hover over elements in the live preview iframe and click to load them into the visual editing sidebar.
          </p>
        </div>
      )}
    </div>
  );
};
