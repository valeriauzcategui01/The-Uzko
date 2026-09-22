import Icono from '../common/Iconos'
import { useSesion } from '../../auth/Sesion'

// Secciones del menú, en orden. Lo que no traiga `group` cae en la primera.
const GROUPS = [
  { id: 'general', label: 'General' },
  { id: 'gestion', label: 'Gestión' },
]

// Qué dice el pie del menú debajo del nombre. Que cada quien vea su rol
// escrito evita la pregunta de "¿por qué a mí no me sale el botón?".
const ROL_TEXTO = {
  admin: 'Puede registrar y editar',
  invitado: 'Solo mira',
}

export default function Sidebar({
  tabs,
  active,
  onSelect,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
}) {
  const { usuario } = useSesion()

  const groups = GROUPS.map((g) => ({
    ...g,
    items: tabs.filter((t) => (t.group ?? GROUPS[0].id) === g.id),
  })).filter((g) => g.items.length > 0)

  return (
    <>
      <div className={`sidebar-backdrop ${mobileOpen ? 'is-open' : ''}`} onClick={onCloseMobile} />
      <aside className={`sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/logo-uzko.jpg" alt="" />
          </div>
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-title">Uzko</div>
            <div className="sidebar-brand-sub">Finanzas personales</div>
          </div>
          <button
            className="sidebar-collapse"
            onClick={onToggleCollapsed}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 4.5 6.5 10l5.5 5.5" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          {groups.map((g) => (
            <div className="nav-group" key={g.id}>
              <span className="nav-group-label">{g.label}</span>
              {g.items.map((t) => (
                <button
                  key={t.id}
                  className={`nav-item ${active === t.id ? 'is-active' : ''}`}
                  onClick={() => onSelect(t.id)}
                  // Contraído solo se ven los íconos, así que el nombre tiene
                  // que llegar por el tooltip del navegador.
                  title={collapsed ? t.label : undefined}
                >
                  <Icono name={t.icon} className="nav-icon" />
                  <span className="nav-label">{t.label}</span>
                  {t.badge > 0 && <span className="nav-badge">{t.badge}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{(usuario?.nombre ?? 'U').slice(0, 1).toUpperCase()}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{usuario?.nombre ?? 'Uzko'}</div>
              <div className="sidebar-user-mail">{ROL_TEXTO[usuario?.rol] ?? 'Cuenta personal'}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
