import { FileMutator } from './file-mutator.js';

export interface HandlerConfig {
  localesPath: string;
  allowedOrigins?: string[];
}

export function createI18nLensHandler(config: HandlerConfig) {
  const mutator = new FileMutator();
  const allowedOrigins = config.allowedOrigins || ['http://localhost:3010', 'http://127.0.0.1:3010'];

  return async function i18nLensMutationHandler(request: Request): Promise<Response> {
    const origin = request.headers.get('origin') || '';
    const isLocalhostStudio = /^http:\/\/(localhost|127\.0\.0\.1):301[0-9]$/.test(origin);
    const allowedOrigin = (allowedOrigins.includes(origin) || isLocalhostStudio) ? origin : (allowedOrigins[0] || '');

    // Setup CORS headers to allow cross-origin requests from the Studio
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    // Handle Preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // RULE GEN-001: DEVELOPMENT-ONLY ENFORCEMENT
    if (process.env['NODE_ENV'] !== 'development') {
      return new Response(
        JSON.stringify({
          error: 'Forbidden: next-i18n-lens can only be run in development mode.',
          code: 'FORBIDDEN',
        }),
        {
          status: 403,
          headers: corsHeaders,
        }
      );
    }

    try {
      // Support GET request to fetch locale content or list locales
      if (request.method === 'GET') {
        const { searchParams } = new URL(request.url);
        const locale = searchParams.get('locale');
        const action = searchParams.get('action');

        if (action === 'keys') {
          try {
            const metadata = await mutator.getKeysMetadata(config.localesPath);
            return new Response(JSON.stringify(metadata), {
              status: 200,
              headers: corsHeaders,
            });
          } catch (err: any) {
            return new Response(
              JSON.stringify({
                error: `Failed to fetch keys metadata: ${err.message}`,
                code: 'KEYS_METADATA_FAILED',
              }),
              {
                status: 500,
                headers: corsHeaders,
              }
            );
          }
        }

        if (!locale) {
          try {
            const localesList = await mutator.listLocales(config.localesPath);
            return new Response(JSON.stringify(localesList), {
              status: 200,
              headers: corsHeaders,
            });
          } catch (err: any) {
            return new Response(
              JSON.stringify({
                error: `Failed to list locales: ${err.message}`,
                code: 'LIST_LOCALES_FAILED',
              }),
              {
                status: 500,
                headers: corsHeaders,
              }
            );
          }
        }

        // Loose regex: supports es-419, zh-Hans, etc.
        if (
          locale.length < 2 ||
          locale.length > 10 ||
          !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/.test(locale)
        ) {
          return new Response(
            JSON.stringify({
              error: 'Invalid locale string parameter.',
              code: 'INVALID_LOCALE_FORMAT',
            }),
            {
              status: 400,
              headers: corsHeaders,
            }
          );
        }
        
        try {
          const resolvedBasePath = path.resolve(config.localesPath);
          const localePath = path.resolve(resolvedBasePath, locale);
          const { promises: fs } = await import('fs');
          
          let isDir = false;
          try {
            const stats = await fs.stat(localePath);
            isDir = stats.isDirectory();
          } catch {}

          if (isDir) {
            const files = await fs.readdir(localePath);
            const merged: Record<string, any> = {};
            for (const file of files) {
              if (file.endsWith('.json')) {
                const ns = path.basename(file, '.json');
                const fileContent = await fs.readFile(path.join(localePath, file), 'utf-8');
                try {
                  merged[ns] = JSON.parse(fileContent);
                } catch {}
              }
            }
            return new Response(JSON.stringify(merged), {
              status: 200,
              headers: corsHeaders,
            });
          } else {
            const resolvedFilePath = pathResolveSafe(config.localesPath, locale);
            const fileContent = await fs.readFile(resolvedFilePath, 'utf-8');
            return new Response(fileContent, {
              status: 200,
              headers: corsHeaders,
            });
          }
        } catch (readErr: any) {
          return new Response(
            JSON.stringify({
              error: `Failed to load locale: ${readErr.message}`,
              code: 'LOCALE_LOAD_FAILED',
            }),
            {
              status: 404,
              headers: corsHeaders,
            }
          );
        }
      }

      // Process POST mutations
      let body: any;
      try {
        body = await request.json();
      } catch (err) {
        return new Response(
          JSON.stringify({
            error: 'Invalid JSON request body',
            code: 'BAD_REQUEST',
          }),
          {
            status: 400,
            headers: corsHeaders,
          }
        );
      }

      const { locale, key, value, action, newLocale } = body || {};

      // Handle custom locale management actions
      if (action === 'addLocale') {
        if (
          typeof locale !== 'string' ||
          locale.length < 2 ||
          locale.length > 10 ||
          !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/.test(locale)
        ) {
          return new Response(
            JSON.stringify({
              error: 'Invalid locale string. Must be 2-10 characters matching standard code pattern.',
              code: 'INVALID_LOCALE_FORMAT',
            }),
            {
              status: 400,
              headers: corsHeaders,
            }
          );
        }
        await mutator.addLocale(config.localesPath, locale);
        return new Response(JSON.stringify({ success: true, locale }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      if (action === 'renameLocale') {
        if (
          typeof locale !== 'string' ||
          locale.length < 2 ||
          locale.length > 10 ||
          !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/.test(locale) ||
          typeof newLocale !== 'string' ||
          newLocale.length < 2 ||
          newLocale.length > 10 ||
          !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/.test(newLocale)
        ) {
          return new Response(
            JSON.stringify({
              error: 'Invalid oldLocale or newLocale parameter.',
              code: 'INVALID_LOCALE_FORMAT',
            }),
            {
              status: 400,
              headers: corsHeaders,
            }
          );
        }
        await mutator.renameLocale(config.localesPath, locale, newLocale);
        return new Response(JSON.stringify({ success: true, locale, newLocale }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      if (action === 'deleteLocale') {
        if (
          typeof locale !== 'string' ||
          locale.length < 2 ||
          locale.length > 10 ||
          !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/.test(locale)
        ) {
          return new Response(
            JSON.stringify({
              error: 'Invalid locale string parameter.',
              code: 'INVALID_LOCALE_FORMAT',
            }),
            {
              status: 400,
              headers: corsHeaders,
            }
          );
        }
        await mutator.deleteLocale(config.localesPath, locale);
        return new Response(JSON.stringify({ success: true, locale }), {
          status: 200,
          headers: corsHeaders,
        });
      }


      // RULE SRV-005: REQUEST BODY VALIDATION (with loose regex matching script and region subtags)
      if (
        typeof locale !== 'string' ||
        locale.length < 2 ||
        locale.length > 10 ||
        !/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,4})?$/.test(locale)
      ) {
        return new Response(
          JSON.stringify({
            error: 'Invalid locale string. Must be 2-10 characters matching standard code pattern.',
            code: 'INVALID_LOCALE_FORMAT',
          }),
          {
            status: 400,
            headers: corsHeaders,
          }
        );
      }

      if (
        typeof key !== 'string' ||
        key.length < 1 ||
        key.length > 200 ||
        !/^[a-zA-Z0-9._-]+$/.test(key)
      ) {
        return new Response(
          JSON.stringify({
            error: 'Invalid key path. Must be 1-200 characters containing alphanumeric, dots, underscores, or hyphens.',
            code: 'INVALID_KEY_FORMAT',
          }),
          {
            status: 400,
            headers: corsHeaders,
          }
        );
      }

      if (typeof value !== 'string' || value.length > 10000) {
        return new Response(
          JSON.stringify({
            error: 'Invalid value. Must be a string less than 10000 characters.',
            code: 'INVALID_VALUE_FORMAT',
          }),
          {
            status: 400,
            headers: corsHeaders,
          }
        );
      }

      await mutator.updateLocaleKey(config.localesPath, locale, key, value);

      return new Response(
        JSON.stringify({
          success: true,
          key,
          locale,
        }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          error: err.message || 'Internal Server Error',
          code: 'INTERNAL_ERROR',
        }),
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }
  };
}

// Reuse safe path resolve logic from file-mutator
import * as path from 'path';
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
