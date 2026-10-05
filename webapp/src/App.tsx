// src/App.tsx
// Ponto de entrada da aplicação web
// =============================================================================

import { useEffect, useState } from 'react'
import AppRouter from './navigation/AppRouter'

type Theme = 'dark' | 'light'

function App() {
  const [theme, setTheme] = useState<Theme>(() =>
    window.localStorage.getItem('finup-theme') === 'light' ? 'light' : 'dark',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('finup-theme', theme)
  }, [theme])

  return (
    <>
      <button
        aria-label={`Ativar tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
        aria-pressed={theme === 'light'}
        className="theme-toggle"
        onClick={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
        title={`Ativar tema ${theme === 'dark' ? 'claro' : 'escuro'}`}
        type="button"
      >
        {theme === 'dark' ? (
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
          </svg>
        )}
      </button>
      <AppRouter />
    </>
  )
}

export default App
