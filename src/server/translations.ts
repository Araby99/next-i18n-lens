import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { wrapTranslationEngine } from '../client/wrap.js';

export interface CreateTranslationsOptions {
  /**
   * Directory containing locale JSON files.
   * @default `process.cwd() + '/locales'`
   */
  localesDir?: string;

  /**
   * List of accepted locale codes.  Any locale not in this list falls back to
   * `fallbackLocale` to prevent path-traversal attacks.
   * @default `['en']`
   */
  supportedLocales?: string[];

  /**
   * Locale to use when the requested locale is unsupported or its file is
   * missing.
   * @default `'en'`
   */
  fallbackLocale?: string;
}

/**
 * Loads a locale JSON file and returns a type-safe translation object that
 * is automatically watermarked in development (for zero-migration studio
 * integration) and returned as-is in production.
 *
 * This is the recommended entry-point for Server Components — no manual
 * `wrapTranslationEngine` call needed.
 *
 * @example
 * ```tsx
 * // app/page.tsx
 * import { createTranslations } from 'next-i18n-lens/server';
 *
 * export default async function Page({ searchParams }) {
 *   const { locale = 'en' } = await searchParams;
 *   const t = createTranslations(locale, {
 *     supportedLocales: ['en', 'ar', 'es'],
 *   });
 *   return <h1>{t.home?.title}</h1>;
 * }
 * ```
 */
export function createTranslations(
  locale: string,
  options: CreateTranslationsOptions = {}
): Record<string, any> {
  const {
    localesDir = join(process.cwd(), 'locales'),
    supportedLocales = ['en'],
    fallbackLocale = 'en',
  } = options;

  // SECURITY: reject locales not in the allow-list to prevent path traversal
  const safeLocale = supportedLocales.includes(locale) ? locale : fallbackLocale;

  const loadFlatFile = (dir: string, loc: string, fallback: string): Record<string, any> => {
    try {
      const raw = readFileSync(join(dir, `${loc}.json`), 'utf-8');
      return JSON.parse(raw);
    } catch {
      try {
        const raw = readFileSync(join(dir, `${fallback}.json`), 'utf-8');
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
  };

  const localePath = join(localesDir, safeLocale);
  let isDir = false;
  try {
    const stats = statSync(localePath);
    isDir = stats.isDirectory();
  } catch {}

  let data: Record<string, any> = {};

  if (isDir) {
    try {
      const files = readdirSync(localePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const ns = file.slice(0, -5);
          const raw = readFileSync(join(localePath, file), 'utf-8');
          try {
            data[ns] = JSON.parse(raw);
          } catch {}
        }
      }
    } catch {
      data = loadFlatFile(localesDir, safeLocale, fallbackLocale);
    }
  } else {
    data = loadFlatFile(localesDir, safeLocale, fallbackLocale);
  }

  return wrapTranslationEngine(data);
}
