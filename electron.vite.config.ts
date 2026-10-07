import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [vue()],
    resolve: { alias: { '@': resolve('src/renderer') } },
  },
});
