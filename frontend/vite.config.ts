import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { Agent } from 'node:http'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:8000'
  // Windows PHP's development server is single-threaded. Avoid idle upstream
  // connections and serialize local API/media requests; production uses a proxy.
  const agent = new Agent({ keepAlive: false, maxSockets: 1 })
  const proxy = Object.fromEntries(['/api', '/sanctum', '/demo'].map(path => [path, { target, changeOrigin: false, agent }]))
  return {
    plugins: [react(), tailwindcss()],
    server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
  }
})
