import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The browser only talks to this dev server. Requests to /api/... are forwarded
// to the FastAPI backend, which avoids CORS (the backend does not enable it).
// 127.0.0.1 instead of "localhost": on Windows, Node can resolve localhost to
// ::1 (IPv6) while `fastapi dev` listens on IPv4 only, and the proxy would fail.
// Another backend address can be set with VITE_API_PROXY_TARGET.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000';

const proxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
