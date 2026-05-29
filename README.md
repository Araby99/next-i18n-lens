# next-i18n-lens

> A local-first, zero-dependency visual translation studio for Next.js (App Router) and React.

Click any translated string in your running app → edit it → watch the JSON file update on disk. No cloud sync, no docker database setup, and zero bundle footprint in production.

---

## How It Works: Zero-Width Unicode Watermarking

`next-i18n-lens` leverages an innovative **Zero-Width Unicode Watermarking** technique to provide a zero-migration, plug-and-play visual editing experience. 

1. **Watermark Encoding:** In development, when keys are translated, `next-i18n-lens` prepends an invisible Unicode zero-width watermark (using combinations of `\u200D` (ZWJ), `\u200B` (ZWS), and `\u200C` (ZWNJ)) to the output string.
2. **DOM Scanning:** In the browser, our lightweight dev listener scans the DOM using a fast `TreeWalker` and a `MutationObserver`. It decodes the watermarks and dynamically adds `data-i18n-key` and `data-i18n-template` attributes to parent elements.
3. **In-Context Editing:** When you hover over text, it highlights. Clicking it opens the editor panel in the Studio.
4. **Input & Form Sanitization:** To prevent these invisible characters from polluting your forms, API payloads, or database, the library automatically patches `HTMLInputElement` and `HTMLTextAreaElement` prototypes and intercepts form submissions to strip watermarks from all user inputs before they are submitted.
5. **Zero Production Footprint:** All proxies, DOM listeners, and interceptors are bypassed in production mode, ensuring raw strings are returned without any overhead.

---

## Features

- 🎯 **In-Context Visual Editing:** Hover to highlight translated elements; click to open the visual editor.
- 🔍 **Locale Directory Sidebar:** A searchable directory displaying all translation keys and their current values in the active locale.
- ⚡ **Atomic File Writes:** Safe temp-to-final swaps protect Next.js HMR from reading half-written JSON data.
- 🔒 **Secure Local Operations:** Strict CORS policies, path-traversal guards, and key-depth recursion limits (up to 10 levels).
- 🧼 **Form & Input Sanitization:** Automatic prototype patching strips zero-width characters before submission.
- 🚀 **Zero Production Footprint:** All handlers and hooks are strictly bypassed in production.
- 🎨 **Sleek 3-Column Interface:** Dark-mode Visual Translation Studio featuring live preview updates and custom confirmation modals.
- 🤖 **CLI Migration Tool:** Automates refactoring of standard `react-i18next` usages.

---

## Installation

```bash
npm install next-i18n-lens
```

---

## Quick Setup

### 1. Wire the Client Listener
Render the `I18nLensProvider` component from `next-i18n-lens/react` in your root layout. It dynamically imports the DOM interceptors at runtime only in development mode.

```tsx
// app/layout.tsx
import { I18nLensProvider } from 'next-i18n-lens/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <I18nLensProvider />
        {children}
      </body>
    </html>
  );
}
```

### 2. Set Up the Server API Handler
Run the CLI initialization command in your project root directory to automatically generate the Server API mutation handler route:

```bash
npx next-i18n-lens init
```

The CLI tool automatically detects:
* **Language**: TypeScript (`tsconfig.json` check) or JavaScript.
* **Routing Structure**: App Router vs. Pages Router.

It writes the appropriate boilerplate file (e.g., `app/api/i18n-lens/mutate/route.ts` or `pages/api/i18n-lens/mutate.ts`) so you are ready to edit.

> [!NOTE]
> If you prefer manual setup, create the route handler at `app/api/i18n-lens/mutate/route.ts` with the following content:
>
> ```typescript
> import { createI18nLensHandler } from 'next-i18n-lens/server';
> import * as path from 'path';
> 
> const handler = createI18nLensHandler({
>   localesPath: path.resolve('./locales'), // Adjust relative to project root
> });
> 
> export const GET = handler;
> export const POST = handler;
> export const OPTIONS = handler; // Supports preflights in cross-origin studio runs
> ```


### 3. Enable Translation Key Watermarking
Wrap your translation dictionaries or functions using `wrapTranslationEngine` so keys are watermarked in development.

#### Option A: Server Components (Automatic Helper)
Use `createTranslations` from `next-i18n-lens/server` to load a locale JSON file and get an automatically watermarked translation object:

```tsx
import { createTranslations } from 'next-i18n-lens/server';

export default async function Page({ searchParams }) {
  const { locale = 'en' } = await searchParams;
  
  const t = createTranslations(locale, {
    supportedLocales: ['en', 'ar', 'es'],
    localesDir: './locales',
  });

  return (
    <main>
      <h1>{t.home?.title}</h1>
      <p>{t.home?.description}</p>
    </main>
  );
}
```

#### Option B: Client/Hooks (e.g. `react-i18next` or `next-intl`)
Wrap translation functions using `wrapTranslationEngine`.

**With react-i18next:**
```tsx
'use client';
import { useTranslation } from 'react-i18next';
import { wrapTranslationEngine } from 'next-i18n-lens/client';

export default function WelcomeComponent() {
  const { t: rawT } = useTranslation('home');
  const t = wrapTranslationEngine(rawT, { keyPrefix: 'home' });

  return <h1>{t('welcome_message')}</h1>;
}
```

**With next-intl:**
```tsx
'use client';
import { useTranslations } from 'next-intl';
import { wrapTranslationEngine } from 'next-i18n-lens/client';

export default function WelcomeComponent() {
  const rawT = useTranslations('home');
  const t = wrapTranslationEngine(rawT, { keyPrefix: 'home' });

  return <h1>{t('welcome_message')}</h1>;
}
```

#### Option C: Manual Data Attributes (Optional Fallback)
If you prefer not to use the watermarking proxy, you can still manually annotate JSX elements:

```tsx
<p data-i18n-key="home.welcome" data-i18n-template="Welcome Back!">
  {t('home.welcome')}
</p>
```

---

## CLI Migration Tool

We provide a built-in CLI tool to automatically refactor existing `react-i18next` codebases to support `next-i18n-lens`.

```bash
npx next-i18n-lens migrate [options]
```

### Options:
- `--dir <path>`: Directory to scan (default: current directory `.`)
- `--exclude <list>`: Comma-separated list of directories to exclude (default: `node_modules,.next,dist,.git`)
- `--dry-run`: Preview changes without writing them to disk

---

## Running the Studio

Start the visual editing studio alongside your Next.js development server.

If running within the package workspace:
```bash
npm run studio:dev
```

If installed as a dependency, open the visual studio running on port `3010`:
```bash
npx next-i18n-lens studio --port 3010
```

Open `http://localhost:3010` to launch the Visual Translation Studio. It will automatically load your Next.js app running on `http://localhost:3000`.

---

## Non-Next.js Integration (Vite / Client-Side React)

If you are not using Next.js (e.g., a client-side Vite + React SPA), you do not have built-in API route handlers. You can replace Next.js API route handlers using a custom Vite plugin inside your `vite.config.ts`:

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
          if (req.url && req.url.startsWith('/api/i18n-lens/mutate')) {
            const urlObj = new URL(req.url, 'http://localhost');
            
            // Set CORS Headers for Studio communications
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
              if (!locale) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing locale parameter' }));
                return;
              }
              try {
                const fileContent = fs.readFileSync(path.resolve(`./locales/${locale}.json`), 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(fileContent);
              } catch (err) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: 'Locale not found' }));
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

## License

MIT License.

