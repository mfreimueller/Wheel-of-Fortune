import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  main: {},
  preload: {
    // A sandboxed preload must be a classic (CommonJS) script.
    build: { rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } } },
  },
  renderer: {
    plugins: [vue()],
    resolve: { alias: { '@': resolve('src/renderer') } },
  },
});
