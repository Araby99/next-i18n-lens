import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig(({ command }) => {
  // Auto-close dev server when parent process closes (e.g. on Windows Ctrl+C or terminal close)
  if (command === 'serve') {
    process.stdin.resume();
    process.stdin.on('end', () => {
      process.exit(0);
    });
  }

  return {
    plugins: [react()],
    root: path.resolve(__dirname),
    server: {
      port: 3010,
      strictPort: true,
      headers: {
        // RULE SEC-002: ENFORCE CONTENT-SECURITY-POLICY HEADER
        'Content-Security-Policy': "frame-src 'self' http://localhost:* http://127.0.0.1:*",
      },
    },
    build: {
      outDir: path.resolve(__dirname, '../../dist/studio'),
      emptyOutDir: true,
    },
  };
});
