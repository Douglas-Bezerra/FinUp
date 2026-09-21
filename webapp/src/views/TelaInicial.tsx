// src/views/TelaInicial.tsx
// Tela de início, após o login, do aplicativo web
// =============================================================================

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { meuUsuario } from '../dataconnect-generated'
import { dataConnect } from '../firebase'
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

function ActionIcon({ type }: { type: 'income' | 'expense' | 'savings' | 'assistant' | 'invite' }) {
  if (type === 'income') return <span aria-hidden="true">↑</span>
  if (type === 'expense') return <span aria-hidden="true">↓</span>
  if (type === 'savings') return <span aria-hidden="true">$</span>
  if (type === 'assistant') return <span aria-hidden="true">✦</span>

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  )
}

export default function TelaInicial() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [feedback, setFeedback] = useState('')
  const [actionFeedback, setActionFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await meuUsuario(dataConnect)
        const user = response.data.usuarios[0]
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
        <p className="welcome">Carregando sua área financeira...</p>
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

  const greeting = getGreeting(new Date().getHours())
  const isPrincipal = profile.papel === 'PRINCIPAL'

  function showComingSoon(action: string) {
    setActionFeedback(`${action}: recurso em breve.`)
  }

  return (
    <main className="home-page">
      <div className="home-shell">
        <header className="home-header">
          <Link className="home-brand" to="/inicio" aria-label="FinUp - início">
            <Logo />
          </Link>
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
            <button className="home-quick-action" type="button" onClick={() => showComingSoon('Receita')}>
              <span className="home-quick-icon home-quick-icon-income"><ActionIcon type="income" /></span>
              <span>Receita</span>
            </button>
            <button className="home-quick-action" type="button" onClick={() => showComingSoon('Despesa')}>
              <span className="home-quick-icon home-quick-icon-expense"><ActionIcon type="expense" /></span>
              <span>Despesa</span>
            </button>
            <button className="home-quick-action" type="button" onClick={() => showComingSoon('Investimentos')}>
              <span className="home-quick-icon home-quick-icon-savings"><ActionIcon type="savings" /></span>
              <span>Investimentos</span>
            </button>
            <button className="home-quick-action" type="button" onClick={() => showComingSoon('Assistente')}>
              <span className="home-quick-icon home-quick-icon-assistant"><ActionIcon type="assistant" /></span>
              <span>Assistente</span>
            </button>
            {isPrincipal && (
              <Link className="home-quick-action" to="/convites" title="Convidar usuário">
                <span className="home-quick-icon home-quick-icon-invite"><ActionIcon type="invite" /></span>
                <span>Convite</span>
              </Link>
            )}
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
        </section>
      </div>
    </main>
  )
}
