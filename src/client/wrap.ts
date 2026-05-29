import { encodeKey } from './watermark.js';

export interface WrapOptions {
  /**
   * A dot-separated key prefix to prepend to all resolved key paths.
   *
   * Use this when wrapping a namespaced translation function (e.g.
   * react-i18next `useTranslation('home')`) so that the watermarked key
   * matches the actual path in your locale JSON file.
   *
   * @example
   * // react-i18next namespace-aware wrapping
   * const { t: rawT } = useTranslation('home');
   * const t = wrapTranslationEngine(rawT, { keyPrefix: 'home' });
   * // t('title') encodes as 'home.title' — matches the JSON structure
   */
  keyPrefix?: string;

  /**
   * Optional fallback translations to use when the target key is missing.
   */
  fallback?: Record<string, any>;
}

/**
 * Wraps any translation function or record (e.g. from next-intl, react-i18next,
 * or a plain locale object loaded server-side) with a JavaScript Proxy that
 * automatically encodes translation keys as invisible zero-width watermark
 * prefixes in development.  In production the proxy is transparent — the
 * original engine is returned as-is.
 *
 * This file has NO "use client" directive so it can be safely imported from
 * both Next.js Server Components and Client Components.
 *
 * @example – Server Component (plain locale object)
 * ```tsx
 * import { wrapTranslationEngine } from 'next-i18n-lens/server';
 * const t = wrapTranslationEngine(loadTranslations(locale));
 * <h1>{t.home?.title}</h1>
 * ```
 *
 * @example – Client Component (next-intl)
 * ```tsx
 * import { wrapTranslationEngine } from 'next-i18n-lens/server';
 * const raw = useTranslations('home');
 * const t = wrapTranslationEngine(raw);
 * <h1>{t('title')}</h1>
 * ```
 */
export function wrapTranslationEngine<T extends object>(
  engine: T,
  options: WrapOptions = {}
): T {
  if (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'development'
  ) {
    return engine;
  }

  return buildProxy(engine, options.keyPrefix ?? '', options);
}

function getNestedProperty(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (path in obj) {
    return obj[path];
  }
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function buildProxy<T extends object>(
  target: T,
  keyPrefix: string,
  options: WrapOptions
): T {
  return new Proxy(target, {
    get(obj, prop: string | symbol) {
      if (typeof prop !== 'string') {
        const val = Reflect.get(obj, prop);
        return typeof val === 'object' && val !== null
          ? buildProxy(val as object, keyPrefix, options)
          : val;
      }

      let val = Reflect.get(obj, prop);
      const fullKey = keyPrefix ? `${keyPrefix}.${prop}` : prop;

      // If val is missing, try looking it up in fallback
      const fallbackObj = options.fallback ?? (typeof window !== 'undefined' ? (window as any).__i18n_lens_fallback__ : undefined);
      if (val === undefined && fallbackObj) {
        const fbVal = getNestedProperty(fallbackObj, fullKey);
        if (fbVal !== undefined) {
          val = fbVal;
        }
      }

      // Leaf string value – encode it with its full key path
      if (typeof val === 'string') {
        return encodeKey(val, fullKey);
      }

      // Function (e.g. t() from next-intl) – wrap the call result
      if (typeof val === 'function') {
        return (...args: unknown[]) => {
          const result = (val as Function).apply(obj, args);
          const calledKey =
            typeof args[0] === 'string'
              ? keyPrefix
                ? `${keyPrefix}.${args[0]}`
                : args[0]
              : fullKey;

          let resolvedValue = result;
          const isMissing =
            resolvedValue === undefined ||
            resolvedValue === null ||
            resolvedValue === '' ||
            (typeof resolvedValue === 'string' &&
              (resolvedValue === args[0] || resolvedValue === calledKey));

          if (isMissing && fallbackObj) {
            const fbVal = getNestedProperty(fallbackObj, calledKey);
            if (fbVal !== undefined) {
              resolvedValue = fbVal;
            }
          }

          if (typeof resolvedValue === 'string') {
            return encodeKey(resolvedValue, calledKey);
          }
          return resolvedValue;
        };
      }

      // Nested object – recurse with updated key path
      if (typeof val === 'object' && val !== null) {
        return buildProxy(val as object, fullKey, options);
      }

      return val;
    },

    // Allow the proxy to be called directly (e.g. t('key'))
    apply(target: any, thisArg, args: unknown[]) {
      const result = Reflect.apply(target, thisArg, args);
      const calledKey =
        typeof args[0] === 'string'
          ? keyPrefix
            ? `${keyPrefix}.${args[0]}`
            : args[0]
          : keyPrefix;

      const fallbackObj = options.fallback ?? (typeof window !== 'undefined' ? (window as any).__i18n_lens_fallback__ : undefined);
      let resolvedValue = result;
      const isMissing =
        resolvedValue === undefined ||
        resolvedValue === null ||
        resolvedValue === '' ||
        (typeof resolvedValue === 'string' &&
          (resolvedValue === args[0] || resolvedValue === calledKey));

      if (isMissing && fallbackObj) {
        const fbVal = getNestedProperty(fallbackObj, calledKey);
        if (fbVal !== undefined) {
          resolvedValue = fbVal;
        }
      }

      if (typeof resolvedValue === 'string') {
        return encodeKey(resolvedValue, calledKey);
      }
      return resolvedValue;
    },
  });
}
