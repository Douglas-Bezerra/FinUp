// src/views/TelaConvites.tsx
// Tela de convites para usuarios secundários do aplicativo web
// =============================================================================

import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { criarConviteAcesso, meuUsuario } from '../dataconnect-generated'
import { dataConnect } from '../firebase'
import LogoutButton from '../components/LogoutButton'
import '../App.css'

function createInviteToken() {
  return crypto.randomUUID()
}

export default function TelaConvites() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await meuUsuario(dataConnect)
        const user = response.data.usuarios[0]
        if (!user || user.papel !== 'PRINCIPAL') {
          navigate('/', { replace: true })
          return
        }
      } catch {
        navigate('/', { replace: true })
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
  }, [navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    setInviteLink('')
    setIsSending(true)

    const token = createInviteToken()
    const dataExpiracao = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    try {
      await criarConviteAcesso(dataConnect, {
        token,
        emailConvidado: email.trim().toLowerCase(),
        dataExpiracao,
      })
      const link = `${window.location.origin}/cadastro?token=${encodeURIComponent(token)}`
      setInviteLink(link)
      setFeedback('Convite criado. Copie o link e envie para o e-mail convidado.')
    } catch (error) {
      console.error('Erro ao criar convite:', error)
      setFeedback('Não foi possível criar o convite. Verifique se você está autenticado.')
    } finally {
      setIsSending(false)
    }
  }

  async function copyInviteLink() {
    await navigator.clipboard.writeText(inviteLink)
    setFeedback('Link copiado para a área de transferência.')
  }

  if (isLoading) {
    return <main className="login-page"><p className="welcome">Carregando...</p></main>
  }

  return (
    <main className="login-page cadastro-page">
      <section className="login-panel standalone-panel" aria-labelledby="convites-title">
        <div className="login-card">
          <div className="standalone-toolbar">
            <Link className="back-link" to="/inicio">Voltar para o início</Link>
            <LogoutButton />
          </div>
          <div className="form-heading">
            <p className="eyebrow">Acesso compartilhado</p>
            <h2 id="convites-title">Convidar usuário secundário</h2>
            <p className="welcome">O convite ficará válido por 7 dias e só poderá ser aceito pelo e-mail informado.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="invite-email">E-mail do convidado</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="convidado@email.com"
              autoComplete="email"
              required
            />
            <button className="submit-button" type="submit" disabled={isSending}>
              {isSending ? 'Criando convite...' : 'Criar convite'}
            </button>
          </form>

          {feedback && <p className="feedback" role="status">{feedback}</p>}
          {inviteLink && (
            <button className="secondary-button" type="button" onClick={copyInviteLink}>
              Copiar link do convite
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
