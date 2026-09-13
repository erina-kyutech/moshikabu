import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// ローカルでは /api を FastAPI (uvicorn) に転送する。
// 本番 (Vercel) では同一オリジンの Serverless Function が /api を処理するため不要。
const apiProxy = {
  '/api': {
    target: process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8000',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: apiProxy },
  preview: { port: 4173, proxy: apiProxy },
})
