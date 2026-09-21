import { onAuthStateChanged, type User } from 'firebase/auth'
import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { auth } from '../firebase'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.currentUser)
  const [isCheckingAuth, setIsCheckingAuth] = useState(!auth.currentUser)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setIsCheckingAuth(false)
    })

    return unsubscribe
  }, [])

  if (isCheckingAuth) {
    return (
      <main className="login-page home-page">
        <p className="welcome">Verificando sua sessão...</p>
      </main>
    )
  }

  return user ? children : <Navigate to="/" replace />
}
