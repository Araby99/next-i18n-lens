# 🔍 next-i18n-lens

<div align="center">
  <p><strong>Click, Edit, and Translate. Locally.</strong></p>
  <p>A local-first, zero-dependency visual translation studio for Next.js (App Router) and React.</p>
  
  <p align="center">
    <a href="https://www.npmjs.com/package/next-i18n-lens"><img src="https://img.shields.io/npm/v/next-i18n-lens.svg?style=flat-square" alt="NPM Version" /></a>
    <a href="https://www.npmjs.com/package/next-i18n-lens"><img src="https://img.shields.io/npm/dm/next-i18n-lens.svg?style=flat-square" alt="NPM Downloads" /></a>
    <a href="https://github.com/Araby99/next-i18n-lens/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/next-i18n-lens.svg?style=flat-square" alt="License" /></a>
  </p>
</div>

---

## 💡 How It Works: Zero-Width Unicode Watermarking

`next-i18n-lens` bridges your running application UI with your local JSON translation files using **Zero-Width Unicode Watermarking**. 

1. **Watermark Encoding:** In development, when a translation key is looked up, the library prepends an invisible Unicode watermark (using combinations of `\u200D` (ZWJ), `\u200B` (ZWS), and `\u200C` (ZWNJ)) to the text.
2. **DOM Scanning:** A lightweight dev-only browser listener scans the active DOM, decodes the watermarks, and dynamically hooks visual highlights onto translated elements.
3. **Input & Clipboard Sanitization:** To ensure the watermarks never pollute your database, forms, or clipboard, the library automatically intercepts `'copy'`/`'paste'` events and patches controlled input elements at runtime.
4. **Zero Production Footprint:** In production mode, all interceptors, listeners, and wrapper logic are bypassed completely, returning plain strings without overhead.

---

## ✨ Features

* 🎯 **In-Context Visual Editing:** Hover over any translated text to highlight it; click to instantly edit in the visual panel.
* 📁 **Namespaced Folder Support:** Handles nested multi-file folder layouts (e.g., `locales/en/auth.json`) natively, merging files during load and separating them during mutation.
* 🧼 **Input & Form Sanitization:** Patches controlled inputs and intercepts clipboard actions to strip watermarks in development automatically.
* ⚡ **Atomic File Operations:** Prevents Next.js hot module replacement (HMR) reading corrupt half-written files via atomic temp-to-final writes.
* 🔒 **Secure Local Boundaries:** Restricts directory traversal, verifies origins, and supports deep schemas up to 30 levels of recursion.
* 🤖 **CLI Migration Tool:** Automatically parses and wraps standard `react-i18next` hooks with a single command.

---

## ⚡ Quick Setup

### 1. Install Dependency
```bash
npm install next-i18n-lens
```

---

### 2. Add the Client Listener
Mount the `I18nLensProvider` inside your root layout. This launches the dev-mode DOM scanners and intercepts clipboard copy/paste actions.
```tsx
// app/layout.tsx
import { I18nLensProvider } from 'next-i18n-lens/react';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <I18nLensProvider />
        {children}
      </body>
    </html>
  );
}
```

---

### 3. Initialize Server Mutation Handler
Initialize the server-side API endpoints automatically by running:
```bash
npx next-i18n-lens init
```
*The CLI will check for TypeScript/JavaScript and write the appropriate mutation file (`/app/api/i18n-lens/mutate/route.ts` or `/pages/api/i18n-lens/mutate.ts`) directly into your project.*

> [!NOTE]
> For manual setup, create `app/api/i18n-lens/mutate/route.ts` with:
> ```typescript
> import { createI18nLensHandler } from 'next-i18n-lens/server';
> import * as path from 'path';
> 
> const handler = createI18nLensHandler({
>   localesPath: path.resolve('./locales'),
> });
> 
> export const GET = handler;
> export const POST = handler;
> export const OPTIONS = handler;
> ```

---

### 4. Enable Key Watermarking
Wrap translation lookups to inject dev-only watermarks.

#### Option A: Server Components (Direct Loader)
Use `createTranslations` to load flat JSON files or directory-based namespaces:
```tsx
import { createTranslations } from 'next-i18n-lens/server';

export default async function Page({ searchParams }) {
  const { locale = 'en' } = await searchParams;
  const t = createTranslations(locale, {
    supportedLocales: ['en', 'ar', 'es'],
    localesDir: './locales',
  });

  return <h1>{t.home?.welcome}</h1>;
}
```

#### Option B: Client-side Hooks (react-i18next or next-intl)
Wrap hook return values with `wrapTranslationEngine`:
```tsx
'use client';
import { useTranslation } from 'react-i18next';
import { wrapTranslationEngine } from 'next-i18n-lens/client';

export default function Page() {
  const { t: rawT } = useTranslation('auth');
  const t = wrapTranslationEngine(rawT, { keyPrefix: 'auth' });

  return <h1>{t('login.title')}</h1>;
}
```

---

### 5. Launch the Visual Studio
Boot the editing studio next to your local development server:
```bash
npx next-i18n-lens studio --port 3010
```
Open `http://localhost:3010` to view the Studio, loaded with your app running at `http://localhost:3000`.

---

## 🛠️ CLI Reference

### `init`
Generates API route handlers based on your router structure (App vs Pages Router) and configuration language (TypeScript vs JavaScript).
```bash
npx next-i18n-lens init [--dir <path>]
```

### `studio`
Spins up a lightweight, CORS-enabled HTTP server serving the Visual Studio assets statically.
```bash
npx next-i18n-lens studio [--port <number>]
```

### `migrate`
Performs static analysis to scan and automatically wrap existing `react-i18next` hooks with `wrapTranslationEngine`.
```bash
npx next-i18n-lens migrate [--dir <path>] [--exclude <dirs>] [--dry-run]
```

---

## ⚙️ Non-Next.js Integration (React + Vite SPA)

If you are using a standard React Client-Side SPA (like Vite), you don't have Next.js API endpoints. You can use a custom Vite plugin inside `vite.config.ts` to capture mutation endpoints:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { FileMutator } from 'next-i18n-lens/server';
import * as path from 'path';
import * as fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vite-plugin-i18n-lens',
      configureServer(server) {
        const mutator = new FileMutator();
        
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/i18n-lens/mutate')) {
            const urlObj = new URL(req.url, 'http://localhost');
            
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }

            if (req.method === 'GET') {
              const locale = urlObj.searchParams.get('locale');
              const localesDir = path.resolve('./locales');
              const target = path.join(localesDir, locale || 'en');
              
              res.setHeader('Content-Type', 'application/json');
              try {
                const isDir = fs.statSync(target).isDirectory();
                if (isDir) {
                  const data: Record<string, any> = {};
                  const files = fs.readdirSync(target);
                  for (const file of files) {
                    if (file.endsWith('.json')) {
                      const ns = file.slice(0, -5);
                      data[ns] = JSON.parse(fs.readFileSync(path.join(target, file), 'utf-8'));
                    }
                  }
                  res.end(JSON.stringify(data));
                } else {
                  res.end(fs.readFileSync(`${target}.json`, 'utf-8'));
                }
              } catch {
                res.end(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf-8'));
              }
              return;
            }

            if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { locale, key, value } = JSON.parse(body);
                  await mutator.updateLocaleKey(path.resolve('./locales'), locale, key, value);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true }));
                } catch (err: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
              return;
            }
          }
          next();
        });
      }
    }
  ]
});
```

---

## ⚖️ License

MIT License. See [LICENSE](file:///e:/works/next-i18n-lens/LICENSE) for more details.
