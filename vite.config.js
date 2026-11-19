import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true
  },
  esbuild: {
    legalComments: 'none'
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    legalComments: 'none',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-core': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'chart-vendor': ['chart.js'],
          'lucide-vendor': ['lucide']
        }
      }
    }
  }
});
