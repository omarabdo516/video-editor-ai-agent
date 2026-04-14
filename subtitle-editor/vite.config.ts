import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Vite 8+ supports tsconfig paths natively
    tsconfigPaths: true,
    // Explicit aliases as a fallback (and so that `@agent/*` works at runtime)
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@agent': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
