// src/views/TelaInicial.tsx
// Tela de início, após o login, do aplicativo web
// =============================================================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { obterUsuario } from '../../../shared/services/finupService'
import { auth, db } from '../firebase'
import BackButton from '../components/BackButton'
import Logo from '../components/Logo'
import LogoutButton from '../components/LogoutButton'
import '../App.css'

type UserProfile = {
  nome: string
  papel: string
}

function getGreeting(hour: number) {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'usuário'
}

function ActionIcon({ type }: { type: 'income' | 'expense' | 'savings' | 'assistant' }) {
  if (type === 'income') return <span aria-hidden="true">↑</span>
  if (type === 'expense') return <span aria-hidden="true">↓</span>
  if (type === 'savings') return <span aria-hidden="true">$</span>
  return <span aria-hidden="true">✦</span>
}

export default function TelaInicial() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [feedback, setFeedback] = useState('')
  const [actionFeedback, setActionFeedback] = useState('')
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
        setFeedback('Não foi possível carregar sua área inicial.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
  }, [])

  if (isLoading) {
    return (
      <main className="login-page home-page">
        <BackButton />
        <p className="welcome">Carregando sua área financeira...</p>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="login-page home-page">
        <section className="home-empty-state">
          <BackButton />
          <Logo />
          <p className="feedback error" role="alert">{feedback}</p>
          <LogoutButton />
        </section>
      </main>
    )
  }

  const greeting = getGreeting(new Date().getHours())
  const isPrincipal = profile.papel === 'PRINCIPAL'

  function showComingSoon(action: string) {
    setActionFeedback(`${action}: recurso em breve.`)
  }

  return (
    <main className="home-page">
      <div className="home-shell">
        <header className="home-header">
          <Link className="home-brand" to="/menu" aria-label="FinUp - menu">
            <Logo />
          </Link>
          <BackButton />
          <div className="home-account">
            <div className="home-avatar" aria-hidden="true">{getFirstName(profile.nome).charAt(0).toUpperCase()}</div>
            <div>
              <strong>{getFirstName(profile.nome)}</strong>
              <span>{isPrincipal ? 'Conta principal' : 'Acesso secundário'}</span>
            </div>
            <LogoutButton />
          </div>
        </header>

        <div className="home-overview-row">
          <section className="home-welcome" aria-labelledby="home-title">
            <p className="eyebrow">Sua vida financeira, com clareza</p>
            <h1 id="home-title">{greeting}, {getFirstName(profile.nome)}.</h1>
            <p>Tenha uma visão simples do que está acontecendo com o seu dinheiro.</p>
          </section>

          <section className="home-quick-actions" aria-label="Ações rápidas">
            <Link className="home-quick-action" to="/registros?tipo=RECEITA" state={{ backTo: '/inicio' }}>
              <span className="home-quick-icon home-quick-icon-income"><ActionIcon type="income" /></span>
              <span>Receita</span>
            </Link>
            <Link className="home-quick-action" to="/registros?tipo=DESPESA" state={{ backTo: '/inicio' }}>
              <span className="home-quick-icon home-quick-icon-expense"><ActionIcon type="expense" /></span>
              <span>Despesa</span>
            </Link>
            <button className="home-quick-action" type="button" onClick={() => showComingSoon('Investimentos')}>
              <span className="home-quick-icon home-quick-icon-savings"><ActionIcon type="savings" /></span>
              <span>Investimentos</span>
            </button>
            <button className="home-quick-action" type="button" onClick={() => showComingSoon('Assistente')}>
              <span className="home-quick-icon home-quick-icon-assistant"><ActionIcon type="assistant" /></span>
              <span>Assistente</span>
            </button>
          </section>
        </div>
        {actionFeedback && <p className="home-action-feedback" role="status">{actionFeedback}</p>}

        <section className="home-grid" aria-label="Resumo financeiro">
          <article className="home-balance-card">
            <span className="home-card-label">SALDO TOTAL</span>
            <strong>R$ 0,00</strong>
            <p>Adicione uma conta para começar a acompanhar seu saldo.</p>
          </article>
          <article className="home-summary-card">
            <span className="home-card-label">ESTE MÊS</span>
            <div className="home-summary-row">
              <div><span>Receitas</span><strong className="home-income">R$ 0,00</strong></div>
              <div><span>Despesas</span><strong className="home-expense">R$ 0,00</strong></div>
            </div>
            <p>Nenhuma movimentação registrada ainda.</p>
          </article>
        </section>

        <section className="home-actions" aria-label="Ações rápidas">
          <div>
            <p className="eyebrow">Próximo passo</p>
            <h2>Comece pelo que importa</h2>
            <p>Organize sua primeira conta e acompanhe suas decisões financeiras.</p>
          </div>
          <Link className="home-action-button" to="/registros" state={{ backTo: '/inicio' }}>
            Registrar movimentação
          </Link>
        </section>
      </div>
    </main>
  )
}
