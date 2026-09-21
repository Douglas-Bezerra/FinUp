import { useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, deleteUser, updateProfile, type User } from 'firebase/auth'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { aceitarConviteAcesso } from '../dataconnect-generated'
import { auth, dataConnect } from '../firebase'
import '../App.css'

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code
    return typeof code === 'string' ? code : ''
  }

  return ''
}

export default function TelaAceitarConvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')

    if (!token) {
      setFeedback('Este link de convite é inválido.')
      return
    }
    if (password.length < 6) {
      setFeedback('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setFeedback('As senhas não coincidem.')
      return
    }

    setIsLoading(true)
    let createdUser: User | null = null

    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
      createdUser = credential.user
      await updateProfile(credential.user, { displayName: name.trim() })

      await aceitarConviteAcesso(dataConnect, {
        token,
        nome: name.trim(),
      })
      navigate('/')
    } catch (error) {
      if (createdUser) {
        await deleteUser(createdUser).catch(() => undefined)
      }

      const code = getErrorCode(error)
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Este e-mail já possui uma conta. Use outro e-mail para aceitar o convite.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
      }
      setFeedback(messages[code] || (error instanceof Error && error.message === 'INVITE_EXPIRED'
        ? 'Este convite expirou.'
        : 'O convite é inválido, já foi utilizado ou não corresponde ao e-mail informado.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page cadastro-page">
      <section className="login-panel standalone-panel" aria-labelledby="aceitar-convite-title">
        <form className="login-card" onSubmit={handleSubmit}>
          <Link className="back-link" to="/">Voltar para o login</Link>
          <div className="form-heading">
            <p className="eyebrow">Convite FinUp</p>
            <h2 id="aceitar-convite-title">Criar acesso secundário</h2>
            <p className="welcome">Use o mesmo e-mail que recebeu o convite.</p>
          </div>

          <label htmlFor="invite-name">Nome completo</label>
          <input id="invite-name" value={name} onChange={(event) => setName(event.target.value)} required />
          <label htmlFor="invite-email">E-mail convidado</label>
          <input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
          <label htmlFor="invite-password">Senha</label>
          <input id="invite-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
          <label htmlFor="invite-confirm-password">Confirmar senha</label>
          <input id="invite-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />

          {feedback && <p className="feedback error" role="alert">{feedback}</p>}
          <button className="submit-button" type="submit" disabled={isLoading}>
            {isLoading ? 'Aceitando convite...' : 'Aceitar convite'}
          </button>
        </form>
      </section>
    </main>
  )
}
