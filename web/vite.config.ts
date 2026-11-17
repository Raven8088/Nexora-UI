/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Development: the SPA runs on Vite and every call to the BFF (/bff, /oauth2, /login) is proxied to it, so the browser
 * sees one origin, as in production (the BFF serves the built SPA).
 */
const bff = process.env.NEXORA_BFF_URL ?? 'http://127.0.0.1:8085';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/bff': { target: bff, changeOrigin: false },
      '/oauth2': { target: bff, changeOrigin: false },
      '/login': { target: bff, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Libraries change less often than the console: separate chunks keep the browser cache useful.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          mantine: ['@mantine/core', '@mantine/hooks', '@mantine/notifications'],
          data: ['@tanstack/react-query', '@tanstack/react-table', 'zod', 'react-hook-form', 'i18next', 'react-i18next'],
          icons: ['@tabler/icons-react'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
