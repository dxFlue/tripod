import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'server/index': 'src/server/index.ts',
    'client/index': 'src/client/index.tsx',
    'shared/index': 'src/shared/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  external: ['react', 'react-dom', 'pino'],
});
