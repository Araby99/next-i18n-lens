import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'client/index': 'src/client/index.ts',
    'server/index': 'src/server/index.ts',
    'react/index': 'src/react/index.tsx',
    'codemod/index': 'src/codemod/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ['next', 'react', 'react-dom', 'fs', 'path', 'typescript'],
});
