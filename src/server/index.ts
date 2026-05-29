export { FileMutator } from './file-mutator.js';
export { createI18nLensHandler, type HandlerConfig } from './next-handler.js';
export { createTranslations, type CreateTranslationsOptions } from './translations.js';

// Watermark utilities — used in Server Components to encode translation keys
// as invisible zero-width prefixes during SSR, enabling plug-and-play detection
// by the client-side DOM scanner without manual data-i18n-* attributes.
export { wrapTranslationEngine, type WrapOptions } from '../client/wrap.js';
export { encodeKey, decodeKey, stripWatermark, hasWatermark } from '../client/watermark.js';
