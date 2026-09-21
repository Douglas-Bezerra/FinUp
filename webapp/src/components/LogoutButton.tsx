// src/components/LogoutButton.tsx
// Botão de logout do aplicativo web
// =============================================================================

import { signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { auth } from '../firebase'

export default function LogoutButton() {
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await signOut(auth)
    } finally {
      navigate('/', { replace: true })
    }
  }

  return (
    <button
      className="logout-button"
      type="button"
      onClick={handleLogout}
      aria-label="Sair da conta"
      title="Sair da conta"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M10 5H5v14h5" />
        <path d="M14 8l4 4-4 4" />
        <path d="M18 12H9" />
      </svg>
    </button>
  )
}
