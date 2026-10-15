// src/components/BackButton.tsx
// Botão de voltar para tela anterior
// =======================================

import { Link, useLocation } from 'react-router-dom'

type BackButtonProps = {
  fallback?: string
  label?: string
}

export default function BackButton({
  fallback = '/menu',
  label = 'Voltar',
}: BackButtonProps) {
  const location = useLocation()
  const locationState = location.state
  const backTo = typeof locationState === 'object'
    && locationState !== null
    && 'backTo' in locationState
    && typeof locationState.backTo === 'string'
    ? locationState.backTo
    : fallback

  return (
    <Link className="back-button" to={backTo} replace aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span>{label}</span>
    </Link>
  )
}
