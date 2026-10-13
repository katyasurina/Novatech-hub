import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Same-origin dev: Vite proxies API + media + socket.io to the Express server,
// so the browser talks to one origin and Cookies "just work" with no CORS dance.
const API_TARGET = process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],

  // Fix for Vercel: esbuild sometimes fails with "The service was stopped" 
  // when building on Linux from a Windows-generated lockfile.
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },

  esbuild: {
    target: 'esnext',
  },

  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/media': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },

  build: {
    target: 'esnext',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});