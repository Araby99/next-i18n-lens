import React from 'react';
import { IframeViewer, EditorPanel, useStudio } from './features/dashboard/index.js';

// Injected by Vite at build/dev time from package.json version (see vite.config.ts).
declare const __STUDIO_VERSION__: string;

export const App = () => {
  const {
    selected,
    inputValue,
    locale,
    connectionStatus,
    isLoading,
    isSuccess,
    error,
    currentPath,
    iframeRef,
    appOrigin,
    showConfirmModal,
    searchTerm,
    filteredKeys,
    localeData,
    coveragePercentage,
    setSearchTerm,
    selectKeyDirectly,
    handleInputChange,
    handleLocaleChange,
    handleSave,
    handleClearSelection,
    confirmDiscard,
    cancelDiscard,
  } = useStudio();

  return (
    <div className="w-screen h-screen flex flex-col bg-[#0b0f19] text-slate-100 font-sans select-none overflow-hidden antialiased">
      {/* Studio Header bar */}
      <header className="h-16 bg-[#080b11]/90 backdrop-blur-md border-b border-slate-900/60 px-8 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-wide font-outfit bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              next-i18n-lens
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase mt-0.5">Live Visual Translation Studio</p>
          </div>
        </div>

        {/* Coverage progress bar + version badge */}
        <div className="flex items-center gap-5">
          {/* Translation coverage metric */}
          <div className="flex items-center gap-2.5" title={`${coveragePercentage}% of keys translated`}>
            <span className="text-[10px] text-slate-500 font-medium select-none whitespace-nowrap">
              Coverage
            </span>
            <div className="w-28 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${coveragePercentage}%`,
                  background:
                    coveragePercentage >= 80
                      ? 'linear-gradient(90deg, #34d399, #059669)'
                      : coveragePercentage >= 40
                      ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                      : 'linear-gradient(90deg, #f87171, #ef4444)',
                }}
              />
            </div>
            <span className="text-[10px] font-bold font-mono text-slate-400 select-none tabular-nums">
              {coveragePercentage}%
            </span>
          </div>

          <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-400 select-none">
            v{__STUDIO_VERSION__} (BETA)
          </span>
        </div>
      </header>

      {/* Main Studio Viewport (Upgraded to 3-column layout) */}
      <main className="flex-1 flex gap-6 p-6 overflow-hidden min-h-0 bg-gradient-to-b from-[#0b0f19] to-[#070a10]">
        
        {/* Column 1: Searchable Keys Directory */}
        <div className="w-[300px] bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full shadow-2xl overflow-hidden shrink-0">
          <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 select-none">
            <h2 className="text-sm font-bold tracking-wide font-outfit text-slate-200">Locale Directory</h2>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-slate-900 text-indigo-400 border border-slate-850">
              {filteredKeys.length} keys
            </span>
          </div>

          {/* Search Box */}
          <div className="p-4 border-b border-slate-800/80 shrink-0 bg-slate-900/40">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search keys or values..."
                className="w-full h-9 pl-9 pr-4 bg-slate-950 border border-slate-800 hover:border-slate-750 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 rounded-lg text-xs text-slate-200 placeholder-slate-600 transition duration-150"
              />
              <svg className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Keys list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
            {filteredKeys.length > 0 ? (
              filteredKeys.map((key) => {
                const isActive = selected?.key === key;
                const valueText = localeData[key] || '';
                return (
                  <button
                    key={key}
                    onClick={() => selectKeyDirectly(key)}
                    className={`w-full text-left p-3 rounded-xl border transition duration-150 flex flex-col gap-1.5 ${
                      isActive
                        ? 'bg-indigo-600/10 border-indigo-500 text-slate-100 shadow-sm'
                        : 'bg-slate-950/20 hover:bg-slate-950/50 border-transparent text-slate-300 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-[11px] font-semibold font-mono break-all line-clamp-2 leading-relaxed text-indigo-400">
                      {key}
                    </span>
                    <span className="text-[10px] text-slate-500 break-all line-clamp-1">
                      {valueText || <span className="italic text-slate-700">Empty</span>}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-600 select-none">
                <svg className="w-8 h-8 text-slate-700 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs">No keys found</span>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: App Preview Frame */}
        <IframeViewer
          iframeRef={iframeRef}
          appOrigin={appOrigin}
          connectionStatus={connectionStatus}
          currentPath={currentPath}
        />

        {/* Column 3: Value Editing Panel */}
        <EditorPanel
          selected={selected}
          inputValue={inputValue}
          locale={locale}
          isLoading={isLoading}
          isSuccess={isSuccess}
          error={error}
          onInputChange={handleInputChange}
          onLocaleChange={handleLocaleChange}
          onSave={handleSave}
          onClear={handleClearSelection}
        />
      </main>

      {/* Custom Confirmation Modal (replacing window.confirm) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-slate-200 font-outfit">Unsaved Changes</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              You have unsaved edits in your translation. Selecting another element will discard these modifications. Do you want to discard your edits?
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={cancelDiscard}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-750 border border-slate-850 hover:border-slate-700 rounded-xl transition duration-150"
              >
                Keep Editing
              </button>
              <button
                onClick={confirmDiscard}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg shadow-rose-600/10 active:bg-rose-700 transition duration-150"
              >
                Discard Edits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default App;
