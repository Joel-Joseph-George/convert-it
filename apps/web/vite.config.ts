import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { vendorPaths } from './scripts/vendor-paths.mjs';

// https://vitejs.dev/config/
export default defineConfig({
  define: { __VENDOR__: JSON.stringify(vendorPaths()) },
  worker: { format: 'es' },
  optimizeDeps: {
    include: ['@huggingface/transformers'],
    // Pre-bundling breaks ffmpeg.wasm's worker URL, so load() never resolves in dev.
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
