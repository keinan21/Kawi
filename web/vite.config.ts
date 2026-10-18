import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  // Proxy dev: tanpa ini `VITE_API_BASE_URL` kosong → client memanggil `/api/*`
  // ke origin Vite (5173) dan selalu 404. API FastAPI tidak memasang CORS,
  // jadi panggilan lintas origin juga ditolak browser — proxy ini membuat dev
  // selalu same-origin. Override target: VITE_API_PROXY_TARGET.
  server: {
    proxy: {
      '/api': {
        target: process.env['VITE_API_PROXY_TARGET'] ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../packages/shared', import.meta.url)),
    },
  },
})
