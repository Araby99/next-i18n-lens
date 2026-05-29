import * as path from 'path';
import * as fs from 'fs';
import { FileMutator } from './file-mutator.js';

function deepMerge(target: any, source: any): any {
  if (typeof target !== 'object' || target === null) return source;
  if (typeof source !== 'object' || source === null) return target;

  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export interface VitePluginConfig {
  /** Absolute or relative path to the directory containing your locale JSON files. */
  localesPath: string;
}

// Reuse the same safe path-resolution logic as next-handler
function pathResolveSafe(basePath: string, locale: string): string {
  if (
    locale.includes('..') ||
    locale.includes('/') ||
    locale.includes('\\') ||
    locale.includes('%') ||
    locale.includes('\0')
  ) {
    throw new Error('Path traversal attempt');
  }
  const resolvedBasePath = path.resolve(basePath);
  const filePath = path.resolve(resolvedBasePath, `${locale}.json`);
  if (!filePath.startsWith(resolvedBasePath)) {
    throw new Error('Path traversal attempt');
  }
  return filePath;
}

const LOCALE_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/;
const KEY_RE = /^[a-zA-Z0-9._-]+$/;
const ROUTE = '/api/i18n-lens/mutate';

/**
 * A Vite plugin that serves the i18n-lens mutation API for Vite-based SPAs
 * (React, Vue, Svelte, etc.) that do not use Next.js.
 *
 * @example
 * // vite.config.ts
 * import { i18nLensVite } from 'next-i18n-lens/vite';
 *
 * export default defineConfig({
 *   plugins: [react(), i18nLensVite({ localesPath: './src/locales' })],
 * });
 */
export function i18nLensVite(config: VitePluginConfig) {
  const mutator = new FileMutator();
  const resolvedLocalesPath = path.resolve(config.localesPath);

  return {
    name: 'next-i18n-lens',
    // Only active during dev server mode; the plugin is a no-op during builds.
    apply: 'serve' as const,

    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (!req.url?.startsWith(ROUTE)) {
          return next();
        }

        // RULE GEN-001: DEVELOPMENT-ONLY ENFORCEMENT
        // The Vite dev server always runs in development mode, but guard
        // explicitly to ensure the plugin is never accidentally run otherwise.
        if (process.env['NODE_ENV'] === 'production') {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              error: 'Forbidden: only available in development mode.',
              code: 'FORBIDDEN',
            })
          );
          return;
        }

        const allowedOrigins = ['http://localhost:3010', 'http://127.0.0.1:3010'];
        const origin = req.headers['origin'] || '';
        const isLocalhostStudio = /^http:\/\/(localhost|127\.0\.0\.1):301[0-9]$/.test(origin);
        const allowedOrigin =
          allowedOrigins.includes(origin) || isLocalhostStudio ? origin : allowedOrigins[0] || '';

        const corsHeaders: Record<string, string> = {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Content-Type': 'application/json',
        };

        const setHeaders = () => {
          Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
        };

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          setHeaders();
          res.statusCode = 204;
          res.end();
          return;
        }

        setHeaders();

        try {
          // ─── GET: Fetch locale dictionary or list locales ───────────────
          if (req.method === 'GET') {
            const urlObj = new URL(req.url, 'http://localhost');
            const locale = urlObj.searchParams.get('locale');
            const action = urlObj.searchParams.get('action');

            if (action === 'keys') {
              try {
                const metadata = await mutator.getKeysMetadata(resolvedLocalesPath);
                res.statusCode = 200;
                res.end(JSON.stringify(metadata));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(
                  JSON.stringify({
                    error: `Failed to fetch keys metadata: ${err.message}`,
                    code: 'KEYS_METADATA_FAILED',
                  })
                );
              }
              return;
            }

            if (!locale) {
              try {
                const localesList = await mutator.listLocales(resolvedLocalesPath);
                res.statusCode = 200;
                res.end(JSON.stringify(localesList));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(
                  JSON.stringify({
                    error: `Failed to list locales: ${err.message}`,
                    code: 'LIST_LOCALES_FAILED',
                  })
                );
              }
              return;
            }

            if (locale.length < 2 || locale.length > 10 || !LOCALE_RE.test(locale)) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  error: 'Invalid locale string parameter.',
                  code: 'INVALID_LOCALE_FORMAT',
                })
              );
              return;
            }

            const localePath = path.resolve(resolvedLocalesPath, locale);
            let isDir = false;
            try {
              const stats = fs.statSync(localePath);
              isDir = stats.isDirectory();
            } catch {}

            if (isDir) {
              const files = fs.readdirSync(localePath);
              const merged: Record<string, any> = {};
              for (const file of files) {
                if (file.endsWith('.json')) {
                  const ns = path.basename(file, '.json');
                  try {
                    const content = fs.readFileSync(path.join(localePath, file), 'utf-8');
                    merged[ns] = JSON.parse(content);
                  } catch {}
                }
              }
              res.statusCode = 200;
              res.end(JSON.stringify(merged));
            } else {
              try {
                const filePath = pathResolveSafe(resolvedLocalesPath, locale);
                const content = fs.readFileSync(filePath, 'utf-8');
                res.statusCode = 200;
                res.end(content);
              } catch (err: any) {
                res.statusCode = 404;
                res.end(
                  JSON.stringify({
                    error: `Failed to load locale: ${err.message}`,
                    code: 'LOCALE_LOAD_FAILED',
                  })
                );
              }
            }
            return;
          }

          // ─── POST: Mutate a translation key ───────────────────────────
          if (req.method === 'POST') {
            let bodyText = '';
            await new Promise<void>((resolve, reject) => {
              req.on('data', (chunk: Buffer) => {
                bodyText += chunk.toString();
              });
              req.on('end', resolve);
              req.on('error', reject);
            });

            let body: any;
            try {
              body = JSON.parse(bodyText);
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON request body', code: 'BAD_REQUEST' }));
              return;
            }

            const { locale, key, value, action, newLocale } = body || {};

            // Handle custom locale management actions
            if (action === 'addLocale') {
              if (
                typeof locale !== 'string' ||
                locale.length < 2 ||
                locale.length > 10 ||
                !LOCALE_RE.test(locale)
              ) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error: 'Invalid locale string parameter.',
                    code: 'INVALID_LOCALE_FORMAT',
                  })
                );
                return;
              }
              await mutator.addLocale(resolvedLocalesPath, locale);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, locale }));
              return;
            }

            if (action === 'renameLocale') {
              if (
                typeof locale !== 'string' ||
                locale.length < 2 ||
                locale.length > 10 ||
                !LOCALE_RE.test(locale) ||
                typeof newLocale !== 'string' ||
                newLocale.length < 2 ||
                newLocale.length > 10 ||
                !LOCALE_RE.test(newLocale)
              ) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error: 'Invalid oldLocale or newLocale parameter.',
                    code: 'INVALID_LOCALE_FORMAT',
                  })
                );
                return;
              }
              await mutator.renameLocale(resolvedLocalesPath, locale, newLocale);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, locale, newLocale }));
              return;
            }

            if (action === 'deleteLocale') {
              if (
                typeof locale !== 'string' ||
                locale.length < 2 ||
                locale.length > 10 ||
                !LOCALE_RE.test(locale)
              ) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error: 'Invalid locale string parameter.',
                    code: 'INVALID_LOCALE_FORMAT',
                  })
                );
                return;
              }
              await mutator.deleteLocale(resolvedLocalesPath, locale);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, locale }));
              return;
            }

            if (
              typeof locale !== 'string' ||
              locale.length < 2 ||
              locale.length > 10 ||
              !LOCALE_RE.test(locale)
            ) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({ error: 'Invalid locale string.', code: 'INVALID_LOCALE_FORMAT' })
              );
              return;
            }

            if (
              typeof key !== 'string' ||
              key.length < 1 ||
              key.length > 200 ||
              !KEY_RE.test(key)
            ) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid key path.', code: 'INVALID_KEY_FORMAT' }));
              return;
            }

            if (typeof value !== 'string' || value.length > 10000) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid value.', code: 'INVALID_VALUE_FORMAT' }));
              return;
            }

            await mutator.updateLocaleKey(resolvedLocalesPath, locale, key, value);

            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, key, locale }));
            return;
          }

          // ─── Unsupported method ────────────────────────────────────────
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err.message || 'Internal Server Error',
              code: 'INTERNAL_ERROR',
            })
          );
        }
      });
    },

    transformIndexHtml(html: string) {
      if (process.env['NODE_ENV'] === 'production') {
        return html;
      }
      try {
        const entries = fs.readdirSync(resolvedLocalesPath);
        let fallbackData: Record<string, any> = {};
        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          const entryPath = path.join(resolvedLocalesPath, entry);
          let entryIsDir = false;
          try {
            entryIsDir = fs.statSync(entryPath).isDirectory();
          } catch {}

          if (entryIsDir) {
            try {
              const files = fs.readdirSync(entryPath);
              for (const file of files) {
                if (file.endsWith('.json')) {
                  const ns = file.slice(0, -5);
                  const raw = fs.readFileSync(path.join(entryPath, file), 'utf-8');
                  try {
                    const parsed = JSON.parse(raw);
                    fallbackData[ns] = deepMerge(fallbackData[ns] || {}, parsed);
                  } catch {}
                }
              }
            } catch {}
          } else if (entry.endsWith('.json')) {
            const raw = fs.readFileSync(entryPath, 'utf-8');
            try {
              const parsed = JSON.parse(raw);
              fallbackData = deepMerge(fallbackData, parsed);
            } catch {}
          }
        }
        const script = `<script>window.__i18n_lens_fallback__ = ${JSON.stringify(fallbackData)};</script>`;
        return html.replace('</head>', `${script}\n</head>`);
      } catch (err) {
        console.warn('[i18n-lens] Failed to inject fallback data:', err);
        return html;
      }
    },
  };
}
