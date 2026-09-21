// src/navigation/AppRouter.tsx
// Rotas do aplicativo webapp
// Ajustes conforme o webapp vai sendo desenvolvido
// =============================================================================

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import TelaCadastroUsuario from '../views/TelaCadastroUsuario'
import TelaAceitarConvite from '../views/TelaAceitarConvite'
import TelaConvites from '../views/TelaConvites'
import TelaLogin from '../views/TelaLogin'
import TelaInicial from '../views/TelaInicial'
import ProtectedRoute from './ProtectedRoute'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TelaLogin />} />
        <Route path="/inicio" element={<ProtectedRoute><TelaInicial /></ProtectedRoute>} />
        <Route path="/cadastro" element={<TelaCadastroUsuario />} />
        <Route path="/convites" element={<ProtectedRoute><TelaConvites /></ProtectedRoute>} />
        <Route path="/aceitar-convite" element={<TelaAceitarConvite />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
