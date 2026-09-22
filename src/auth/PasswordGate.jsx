import { useEffect, useState } from 'react'
import { useSesion } from './Sesion.jsx'

// Muro de acceso.
//
// Con varias personas configuradas, primero eliges quién eres y después
// escribes tu clave. Elegir de una lista en vez de escribir un usuario es
// deliberado: esto se va a abrir sobre todo desde el teléfono, y ahí un toque
// siempre gana a teclear.
//
// Si el servidor todavía está en el modo viejo de contraseña única, la pantalla
// se reduce a un campo de clave, como antes.
export function PasswordGate({ children }) {
  const { estado, modo, usuarios, entrar } = useSesion()
  const [quien, setQuien] = useState(null)
  const [clave, setClave] = useState('')
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)

  // Con una sola persona configurada no tiene sentido hacerla elegir.
  useEffect(() => {
    if (modo === 'personas' && usuarios.length === 1) setQuien(usuarios[0])
  }, [modo, usuarios])

  const enviar = async (e) => {
    e.preventDefault()
    setOcupado(true)
    setErr('')
    try {
      await entrar(quien?.id ?? 'uzko', clave)
    } catch (e2) {
      setErr(e2.message || 'No se pudo entrar')
      setClave('')
    } finally {
      setOcupado(false)
    }
  }

  if (estado === 'cargando') {
    return (
      <div className="login-screen">
        <div className="spinner" />
      </div>
    )
  }
  if (estado === 'dentro') return children

  const porPersonas = modo === 'personas' && usuarios.length > 0

  return (
    <div className="login-screen">
      <div className="login-brand">
        <div className="login-logo">
          <img src="/logo-uzko.jpg" alt="" />
        </div>
        <div>
          <div className="login-title">Uzko</div>
          <div className="login-sub">Finanzas personales · acceso privado</div>
        </div>
      </div>

      {modo === 'abierto' && (
        <div className="login-card">
          <p className="login-error">
            ⚠️ El sitio todavía no tiene acceso configurado. Agrega la variable{' '}
            <strong>USUARIOS</strong> en Vercel y vuelve a desplegar.
          </p>
        </div>
      )}

      {porPersonas && !quien && (
        <div className="login-card">
          <p className="login-label">¿Quién eres?</p>
          <div className="login-personas">
            {usuarios.map((u) => (
              <button
                key={u.id}
                type="button"
                className="login-persona"
                onClick={() => {
                  setQuien(u)
                  setErr('')
                }}
              >
                <span className="login-persona-inicial">{u.nombre.slice(0, 1).toUpperCase()}</span>
                <span className="login-persona-nombre">{u.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {(!porPersonas || quien) && modo !== 'abierto' && (
        <form className="login-card" onSubmit={enviar}>
          {quien && (
            <div className="login-quien">
              <span className="login-persona-inicial">{quien.nombre.slice(0, 1).toUpperCase()}</span>
              <span className="login-persona-nombre">{quien.nombre}</span>
              {usuarios.length > 1 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm login-cambiar"
                  onClick={() => {
                    setQuien(null)
                    setClave('')
                    setErr('')
                  }}
                >
                  Cambiar
                </button>
              )}
            </div>
          )}
          <label className="login-label" htmlFor="clave">Contraseña</label>
          <input
            id="clave"
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="••••••••"
            autoFocus
            autoComplete="current-password"
          />
          {err && <p className="login-error">⚠️ {err}</p>}
          <button className="btn btn-primary login-submit" disabled={ocupado || !clave}>
            {ocupado ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      )}
    </div>
  )
}

// Botón de salir, en el header.
export function LogoutButton() {
  const { usuario, salir } = useSesion()
  return (
    <button className="btn btn-ghost btn-sm" onClick={salir} title={usuario ? `Salir de la sesión de ${usuario.nombre}` : 'Cerrar sesión'}>
      Salir
    </button>
  )
}
