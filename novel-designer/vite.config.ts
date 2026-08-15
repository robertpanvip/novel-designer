import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' 使 dist 可作为静态目录/双击打开
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173
  }
})
