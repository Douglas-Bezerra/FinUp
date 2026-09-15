// src/views/TelaCadastro.tsx
// Tela de cadastro do aplicativo web para usuários principal e secundários
// =============================================================================

import { useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, deleteUser, updateProfile, type User } from 'firebase/auth'
import { Link, useNavigate } from 'react-router-dom'
import { criarUsuario } from '../dataconnect-generated'
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

const emptyErrors: FormErrors = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export default function TelaCadastro() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
      await criarUsuario(dataConnect, {
        nome: name.trim(),
        email: email.trim(),
        papel: 'PRINCIPAL',
      })
      navigate('/')
    } catch (error: unknown) {
      if (createdUser) {
        await deleteUser(createdUser).catch(() => undefined)
      }

      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
      }

      setFeedback(messages[getAuthErrorCode(error)] || 'Não foi possível criar a conta. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-page cadastro-page">
      <section className="login-shell" aria-labelledby="cadastro-title">
        <div className="brand">
          <Logo />
        </div>

        <form className="login-card cadastro-card" onSubmit={handleSubmit}>
          <Link className="back-link" to="/">Voltar para o login</Link>
          <h1 id="cadastro-title">Criar conta principal</h1>
          <p className="welcome cadastro-intro">
            Cadastre sua conta para começar a organizar sua vida financeira.
          </p>

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
          <input
            id="cadastro-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mín. 6 caracteres"
            autoComplete="new-password"
            required
          />
          {errors.password && <span className="form-error">{errors.password}</span>}

          <label htmlFor="confirm-password">Confirmar senha</label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repita a senha"
            autoComplete="new-password"
            required
          />
          {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}

          {feedback && <p className="feedback error" role="alert">{feedback}</p>}

          <button className="submit-button" type="submit" disabled={isLoading}>
            {isLoading ? 'Criando conta...' : 'Criar conta grátis'}
          </button>
        </form>
      </section>
    </main>
  )
}