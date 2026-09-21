// src/views/TelaAceitarConvite.tsx
// Tela de aceitação de convite para usuário secundário do aplicativo web
// Tela mantida para compatibilidade com versões anteriores do aplicativo
// =============================================================================

import { Navigate, useSearchParams } from 'react-router-dom'

export default function TelaAceitarConvite() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  return <Navigate to={`/cadastro${token ? `?token=${encodeURIComponent(token)}` : ''}`} replace />
}
