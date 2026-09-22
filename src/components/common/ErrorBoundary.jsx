import { Component } from 'react'

// Evita la "pantalla en blanco": si un componente lanza un error al renderizar,
// muestra un mensaje claro en vez de romper toda la app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Queda en la consola del navegador para diagnóstico.
    console.error('Error de render:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="dashboard-loading">
          <p>⚠️ Ocurrió un error al mostrar la app.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 420, textAlign: 'center' }}>
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
