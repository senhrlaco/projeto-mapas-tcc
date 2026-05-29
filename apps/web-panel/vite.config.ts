import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // forca uma unica copia do react para evitar conflito com react-map-gl
    dedupe: ['react', 'react-dom'],
  },
})
