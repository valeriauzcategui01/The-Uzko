import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { SesionProvider } from './auth/Sesion.jsx'
import { PasswordGate } from './auth/PasswordGate.jsx'
import ErrorBoundary from './components/common/ErrorBoundary.jsx'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SesionProvider>
        <PasswordGate>
          <App />
        </PasswordGate>
      </SesionProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Solo en producción: en `npm run dev` un service worker serviría archivos
// viejos y confundiría más de lo que ayuda.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
