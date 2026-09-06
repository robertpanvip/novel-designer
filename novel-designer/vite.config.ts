import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' 使 dist 可作为静态目录/双击打开
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
    // /api 一律转发到后端（npm run server）。SSE 续写不能被代理层缓冲
    proxy: {
      '/api': {
        // 后端默认端口；需要改端口时用 API_TARGET 环境变量覆盖
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const ct = String(proxyRes.headers['content-type'] ?? '');
            if (ct.includes('text/event-stream')) {
              proxyRes.headers['cache-control'] = 'no-cache, no-transform';
            }
          });
        }
      }
    }
  }
})
