// src/main.tsx
// Arquivo principal do aplicativo web que chama o App.tsx
// Para rodar em localhost, execute npm run dev.
// Para executar o projeto web, execute "npm start" no terminal
// =============================================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Elemento raiz do aplicativo nao encontrado.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
