// src/components/Logo.tsx
// Componente de logotipo do projeto webapp
// =============================================================================

import '../App.css'
import logo from '../assets/logosimples.jpeg'

export default function Logo() {
  return (
    <div className="logo-component" aria-label="FinUp - Controle Financeiro Pessoal">
      <div className="logo-box" aria-hidden="true">
        <div className="logo-box-inner">
          <img src={logo} alt="FinUp" className="logo-image" />
        </div>
      </div>

      <div className="logo-name" aria-hidden="true">
        <span>Fin</span>
        <strong>Up</strong>
      </div>

      <p className="logo-subtitle">Controle Financeiro Pessoal</p>
    </div>
  )
}
