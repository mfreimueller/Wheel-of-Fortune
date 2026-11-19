import { resolve } from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// Relative base: the build works under any GitHub Pages path (`/<repo>/`) and when opened from a subfolder.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  publicDir: resolve(__dirname, 'assets'),
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src/renderer') } },
  build: { outDir: resolve(__dirname, 'dist'), emptyOutDir: true },
});
