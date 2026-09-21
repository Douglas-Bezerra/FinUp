// src/views/TelaCadastroUsuario.tsx
// Tela de cadastro do aplicativo web para usuários principal e secundários
// =============================================================================

import { useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, deleteUser, updateProfile, type User } from 'firebase/auth'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { aceitarConviteAcesso, criarUsuario } from '../dataconnect-generated'
import { auth, dataConnect } from '../firebase'
import Logo from '../components/Logo'
import '../App.css'

type FormErrors = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

function getAuthErrorCode(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code
    return typeof code === 'string' ? code : ''
  }

  return ''
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      {hidden ? (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      ) : (
        <>
          <path d="m3 3 18 18" />
          <path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a18.4 18.4 0 0 1-3.1 3.6M6.2 6.8C3.4 8.5 2 12 2 12s3.5 6 10 6a10.7 10.7 0 0 0 3.4-.5" />
        </>
      )}
    </svg>
  )
}

const emptyErrors: FormErrors = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export default function TelaCadastroUsuario() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invitationToken = searchParams.get('token') || ''
  const isInvitation = Boolean(invitationToken)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errors, setErrors] = useState<FormErrors>(emptyErrors)
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function validateForm() {
    const nextErrors: FormErrors = { ...emptyErrors }

    if (!name.trim()) {
      nextErrors.name = 'Informe seu nome completo.'
    } else if (/\d/.test(name)) {
      nextErrors.name = 'O nome não pode conter números.'
    }

    if (!email.trim()) {
      nextErrors.email = 'Informe seu e-mail.'
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = 'Informe um e-mail válido.'
    }

    if (!password) {
      nextErrors.password = 'Informe uma senha.'
    } else if (password.length < 6) {
      nextErrors.password = 'A senha deve ter pelo menos 6 caracteres.'
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirme sua senha.'
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'As senhas não coincidem.'
    }

    setErrors(nextErrors)
    return Object.values(nextErrors).every((error) => !error)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')

    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    let createdUser: User | null = null

    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      createdUser = credential.user
      await updateProfile(credential.user, { displayName: name.trim() })
      if (isInvitation) {
        await aceitarConviteAcesso(dataConnect, {
          token: invitationToken,
          nome: name.trim(),
        })
        navigate('/inicio', { replace: true })
      } else {
        await criarUsuario(dataConnect, {
          nome: name.trim(),
          email: email.trim(),
          papel: 'PRINCIPAL',
        })
        navigate('/')
      }
    } catch (error: unknown) {
      if (createdUser) {
        await deleteUser(createdUser).catch(() => undefined)
      }

      if (import.meta.env.DEV) {
        console.error('Erro ao cadastrar usuário:', error)
      }

      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/api-key-not-valid': 'A configuração do Firebase Web está inválida. Verifique a API key.',
        'auth/invalid-api-key': 'A configuração do Firebase Web está inválida. Verifique a API key.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/network-request-failed': 'Não foi possível conectar ao Firebase.',
        'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
      }

      const authErrorCode = getAuthErrorCode(error)
      const message = messages[authErrorCode] || (createdUser
        ? 'A conta não foi concluída porque não foi possível salvar seus dados. Verifique se o emulador do Data Connect está ativo.'
        : `Não foi possível ${isInvitation ? 'aceitar o convite' : 'criar a conta'}${authErrorCode ? ` (${authErrorCode})` : ''}. Verifique a configuração do Firebase e tente novamente.`)

      setFeedback(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page cadastro-page">
      <div className="login-layout">
        <div>
          <section className="login-logo" aria-label="FinUp">
            <Link className="back-link" to="/">Voltar para o login</Link>
            <Logo />
          </section>
        </div>

        <section className="login-showcase" aria-label="FinUp">
          <div className="showcase-copy">
            <p className="eyebrow">Um novo começo financeiro</p>
            <h1>
              Organize hoje.
              <br />
              <span>Viva melhor amanhã.</span>
            </h1>
            <p className="showcase-description">
              Crie sua conta e tenha uma visão mais clara das suas contas,
              objetivos e escolhas financeiras.
            </p>
          </div>
          <div className="showcase-insight" aria-hidden="true">
            <span className="insight-label">seu próximo passo</span>
            <strong>Planos mais claros</strong>
            <span className="insight-caption">comece pelo que importa</span>
            <div className="insight-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </section>

        <section className="login-panel" aria-labelledby="cadastro-title">
          <form className="login-card cadastro-card" onSubmit={handleSubmit}>
            <div className="form-heading">
              
              <p className="eyebrow">{isInvitation ? 'Convite FinUp' : 'Comece sua jornada'}</p>
              <h2 id="cadastro-title">{isInvitation ? 'Criar acesso secundário' : 'Criar conta principal'}</h2>
              <p className="welcome cadastro-intro">
                {isInvitation
                  ? 'Use o e-mail que recebeu o convite para concluir seu acesso.'
                  : 'Cadastre sua conta para começar a organizar sua vida financeira.'}
              </p>
            </div>

          <label htmlFor="name">Nome completo</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Seu nome completo"
            autoComplete="name"
            required
          />
          {errors.name && <span className="form-error">{errors.name}</span>}

          <label htmlFor="cadastro-email">E-mail</label>
          <input
            id="cadastro-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            required
          />
          {errors.email && <span className="form-error">{errors.email}</span>}

          <label htmlFor="cadastro-password">Senha</label>
          <div className="password-field">
            <input
              id="cadastro-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mín. 6 caracteres"
              autoComplete="new-password"
              required
            />
            <button
              className="visibility-button"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
            >
              <EyeIcon hidden={!showPassword} />
            </button>
          </div>
          {errors.password && <span className="form-error">{errors.password}</span>}

          <label htmlFor="confirm-password">Confirmar senha</label>
          <div className="password-field">
            <input
              id="confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita a senha"
              autoComplete="new-password"
              required
            />
            <button
              className="visibility-button"
              type="button"
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              aria-label={showConfirmPassword ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'}
              title={showConfirmPassword ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'}
              aria-pressed={showConfirmPassword}
            >
              <EyeIcon hidden={!showConfirmPassword} />
            </button>
          </div>
          {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}

          {feedback && <p className="feedback error" role="alert">{feedback}</p>}

          <button className="submit-button" type="submit" disabled={isLoading}>
            {isLoading
              ? (isInvitation ? 'Aceitando convite...' : 'Criando conta...')
              : (isInvitation ? 'Aceitar convite' : 'Criar conta grátis')}
          </button>
          </form>
        </section>
      </div>
    </main>
  )
}
