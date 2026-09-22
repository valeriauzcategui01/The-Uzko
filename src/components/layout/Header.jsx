import { useApp } from '../../context/AppContext'
import { useSesion } from '../../auth/Sesion'
import { etiquetaMes } from '../../lib/calculos'
import { LogoutButton } from '../../auth/PasswordGate'

const ROL_TEXTO = {
  admin: 'Puede registrar y editar',
  invitado: 'Solo mira',
}

export default function Header({ title, subtitle, onToggleNav, conMes = true }) {
  const { mes, setMes, meses, recargar, cargando } = useApp()
  const { usuario } = useSesion()

  return (
    <header className="header">
      <div className="header-left">
        <button className="icon-btn header-burger" onClick={onToggleNav} aria-label="Menú">
          ☰
        </button>
        <div>
          <h1 className="header-title">{title}</h1>
          <p className="header-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="header-right">
        {conMes && meses.length > 0 && (
          <div className="month-picker">
            <span className="month-picker-icon" aria-hidden>📅</span>
            <select
              value={mes ?? ''}
              onChange={(e) => setMes(e.target.value)}
              aria-label="Mes seleccionado"
            >
              {meses.map((m) => (
                <option key={m} value={m}>
                  {etiquetaMes(m)}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="btn btn-ghost btn-sm" onClick={recargar} disabled={cargando}>
          <span aria-hidden>⟳</span> {cargando ? 'Cargando…' : 'Recargar'}
        </button>
        {usuario && (
          <span className="header-usuario" title={ROL_TEXTO[usuario.rol] ?? usuario.rol}>
            <span className="header-usuario-inicial">{usuario.nombre.slice(0, 1).toUpperCase()}</span>
            <span className="header-usuario-nombre">{usuario.nombre}</span>
          </span>
        )}
        <LogoutButton />
      </div>
    </header>
  )
}
