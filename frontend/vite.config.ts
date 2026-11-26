import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_RANGEX_BACKEND_TARGET || 'http://127.0.0.1:8080'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: backendTarget.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (
              id.includes('node_modules/three') ||
              id.includes('node_modules/@react-three')
            ) {
              return 'three-vendor'
            }
            if (
              id.includes('node_modules/gsap') ||
              id.includes('node_modules/framer-motion') ||
              id.includes('node_modules/lenis')
            ) {
              return 'motion-vendor'
            }
          },
        },
      },
    },
  }
})
