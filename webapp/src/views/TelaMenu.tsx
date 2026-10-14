// src/views/TelaMenu.tsx
// Menu de navegação exibido após a autenticação
// =============================================================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obterUsuario } from '../../../shared/services/finupService'
import { auth, db } from '../firebase'
import Logo from '../components/Logo'
import LogoutButton from '../components/LogoutButton'
import '../App.css'

type UserProfile = {
  nome: string
  papel: string
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'usuário'
}

export default function TelaMenu() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const currentUser = auth.currentUser
        if (!currentUser) {
          setFeedback('Sua sessão expirou. Entre novamente.')
          return
        }

        const user = await obterUsuario(db, currentUser.uid)
        if (!user) {
          setFeedback('Não encontramos o seu perfil financeiro.')
          return
        }

        setProfile({ nome: user.nome, papel: user.papel })
      } catch (error) {
        console.error('Erro ao carregar perfil:', error)
        setFeedback('Não foi possível carregar o menu.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
  }, [])

  if (isLoading) {
    return (
      <main className="login-page home-page">
        <p className="welcome">Carregando seu menu...</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="login-page home-page">
        <section className="home-empty-state">
          <Logo />
          <p className="feedback error" role="alert">{feedback}</p>
          <LogoutButton />
        </section>
      </main>
    )
  }

  const firstName = getFirstName(profile.nome)
  const isPrincipal = profile.papel === 'PRINCIPAL'

  return (
    <main className="home-page">
      <div className="home-shell">
        <header className="home-header">
          <Link className="home-brand" to="/menu" aria-label="FinUp - menu">
            <Logo />
          </Link>
          <div className="home-account">
            <div className="home-avatar" aria-hidden="true">{firstName.charAt(0).toUpperCase()}</div>
            <div>
              <strong>{firstName}</strong>
              <span>{isPrincipal ? 'Conta principal' : 'Acesso secundário'}</span>
            </div>
            <LogoutButton />
          </div>
        </header>

        <section className="home-welcome" aria-labelledby="menu-title">
          <p className="eyebrow">Sua vida financeira, com clareza</p>
          <h1 id="menu-title">Olá, {firstName}.</h1>
          <p>O que você gostaria de fazer?</p>
        </section>

        <nav className="menu-options" aria-label="Opções principais">
          <Link className="menu-option-button" to="/gerenciamento" state={{ backTo: '/menu' }}>
            <span className="menu-option-icon" aria-hidden="true">⌂</span>
            <span className="menu-option-label">Visão geral e gerenciamento</span>
            <span className="menu-option-arrow" aria-hidden="true">›</span>
          </Link>
          <Link className="menu-option-button" to="/registros" state={{ backTo: '/menu' }}>
            <span className="menu-option-icon" aria-hidden="true">＋</span>
            <span className="menu-option-label">Lançamentos</span>
            <span className="menu-option-arrow" aria-hidden="true">›</span>
          </Link>
          {isPrincipal && (
            <Link className="menu-option-button" to="/convites" state={{ backTo: '/menu' }}>
              <span className="menu-option-icon" aria-hidden="true">✉</span>
              <span className="menu-option-label">Convites</span>
              <span className="menu-option-arrow" aria-hidden="true">›</span>
            </Link>
          )}
        </nav>
      </div>
    </main>
  )
}
