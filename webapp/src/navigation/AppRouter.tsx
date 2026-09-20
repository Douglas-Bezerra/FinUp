// src/navigation/AppRouter.tsx
// Rotas do aplicativo webapp
// Ajustes conforme o webapp vai sendo desenvolvido
// =============================================================================

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import TelaCadastroUsuario from '../views/TelaCadastroUsuario'
import TelaLogin from '../views/TelaLogin'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TelaLogin />} />
        <Route path="/cadastro" element={<TelaCadastroUsuario />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
