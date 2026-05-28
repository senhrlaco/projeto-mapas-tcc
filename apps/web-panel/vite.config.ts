import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // forca uma unica copia do React - sem isso o react-map-gl quebra com "Invalid hook call"
    dedupe: ['react', 'react-dom'],
  },
})
