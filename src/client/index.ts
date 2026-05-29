'use client';

import { DOMInterceptor } from './dom-interceptor.js';
import { IframeBridge } from './iframe-bridge.js';

export { DOMInterceptor } from './dom-interceptor.js';
export { IframeBridge, type TranslationPayload, type ClientMessageType, type StudioMessageType } from './iframe-bridge.js';
export { encodeKey, decodeKey, stripWatermark, hasWatermark } from './watermark.js';

// wrapTranslationEngine lives in wrap.ts (no 'use client') so it can also be
// imported by Server Components via 'next-i18n-lens/server'.
export { wrapTranslationEngine, type WrapOptions } from './wrap.js';

// ─── Auto-initialization ────────────────────────────────────────────────────

// Auto-initialize the interceptor if running in the browser, in development mode,
// AND only when the page is embedded inside the studio iframe (not accessed directly).
if (
  typeof window !== 'undefined' &&
  process.env.NODE_ENV === 'development' &&
  window.parent !== window // <-- iframe guard: only activate inside the studio
) {
  const urlParams = new URLSearchParams(window.location.search);
  const allowedOrigin = urlParams.get('i18n-lens-origin') || 'http://localhost:3010';

  const bridge = new IframeBridge(allowedOrigin);
  const interceptor = new DOMInterceptor(
    (payload) => {
      bridge.sendToParent('ELEMENT_SELECTED', payload);
    },
    (keys) => {
      bridge.sendToParent('VISIBLE_KEYS_CHANGED', keys);
    }
  );

  interceptor.init();

  // Send a READY message to the parent studio
  bridge.sendToParent('READY', { url: window.location.pathname + window.location.search });

  // Listen to studio commands
  bridge.listenToParent((type) => {
    if (type === 'CLEAR_SELECTION') {
      // Re-trigger/reset interceptor highlight states
      interceptor.destroy();
      interceptor.init();
    }
  });

  // Attach reference to window for developer inspection/diagnostics
  (window as any).__NEXT_I18N_LENS_CLIENT__ = {
    bridge,
    interceptor,
  };
}
