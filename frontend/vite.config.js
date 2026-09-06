import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '::',
    port: 3000,
    open: false,
    strictPort: true
  },
  preview: {
    host: '::',
    port: 3000,
    open: false,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
