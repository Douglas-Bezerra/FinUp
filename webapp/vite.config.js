// webapp/vite.config.js
// Configuração do Vite para o projeto webapp
// ==========================================

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['firebase'],
  },
})
