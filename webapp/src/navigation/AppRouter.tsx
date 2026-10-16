// webapp/src/navigation/AppRouter.tsx
// Rotas do aplicativo webapp
// Ajustes conforme o webapp vai sendo desenvolvido
// =============================================================================

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import TelaCadastroUsuario from '../views/TelaCadastroUsuario'
import TelaAceitarConvite from '../views/TelaAceitarConvite'
import TelaConvites from '../views/TelaConvites'
import TelaCadastroRegistros from '../views/TelaCadastroRegistros'
import TelaLogin from '../views/TelaLogin'
import TelaMenu from '../views/TelaMenu'
import TelaGerenciamento from '../views/TelaGerenciamento'
import ProtectedRoute from './ProtectedRoute'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TelaLogin />} />
        <Route path="/menu" element={<ProtectedRoute><TelaMenu /></ProtectedRoute>} />
        <Route path="/inicio" element={<Navigate to="/menu" replace />} />
        <Route path="/gerenciamento" element={<ProtectedRoute><TelaGerenciamento /></ProtectedRoute>} />
        <Route path="/registros" element={<ProtectedRoute><TelaCadastroRegistros /></ProtectedRoute>} />
        <Route path="/cadastro" element={<TelaCadastroUsuario />} />
        <Route path="/convites" element={<ProtectedRoute><TelaConvites /></ProtectedRoute>} />
        <Route path="/aceitar-convite" element={<TelaAceitarConvite />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
