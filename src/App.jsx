import { useEffect, useMemo, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import Resumen from './components/dashboard/Resumen'
import Movimientos from './components/movimientos/Movimientos'
import Presupuesto from './components/presupuesto/Presupuesto'
import Cuentas from './components/cuentas/Cuentas'
import Bandeja from './components/bandeja/Bandeja'
import { etiquetaMes } from './lib/calculos'

// El sidebar contraído se recuerda entre visitas: es una preferencia de cómo
// quieres ver la app, no algo que valga la pena volver a elegir cada vez.
const COLLAPSE_KEY = 'uzko.navCollapsed'

const TABS = [
  { id: 'resumen', label: 'Resumen', icon: 'grafica', group: 'general' },
  { id: 'movimientos', label: 'Movimientos', icon: 'recibo', group: 'general' },
  { id: 'presupuesto', label: 'Presupuesto', icon: 'calendario', group: 'general' },
  { id: 'bandeja', label: 'Bandeja', icon: 'bandeja', group: 'gestion' },
  { id: 'cuentas', label: 'Cuentas', icon: 'tarjeta', group: 'gestion' },
]

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}

// EL "COMPARTIR A UZKO" DEL TELÉFONO.
//
// El manifest declara un share_target: cuando Valerio comparte la
// notificación del banco con la app, Android la abre con el texto en la URL
// (?share_text=...). Ese texto se manda a la bandeja —el mismo camino que el
// webhook— y la app abre ahí, con el mensaje ya leído y listo para
// confirmar. Se limpia la URL al terminar para que un refresco no lo mande
// dos veces.
function leerCompartido() {
  const p = new URLSearchParams(window.location.search)
  const texto = [p.get('share_title'), p.get('share_text'), p.get('share_url')]
    .filter(Boolean)
    .join(' ')
    .trim()
  return texto || null
}

function Shell() {
  const { movimientos, bandejaNuevas, setBandejaNuevas, mes } = useApp()
  const [tab, setTab] = useState('resumen')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  // Lo compartido se manda una vez, al montar. Si falla (sin sesión todavía,
  // sin red), el texto sigue en la URL y el siguiente intento lo recoge.
  useEffect(() => {
    const texto = leerCompartido()
    if (!texto) return
    fetch('/api/bandeja', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accion: 'compartir', texto }),
    })
      .then((r) => {
        if (!r.ok) throw new Error()
        window.history.replaceState(null, '', '/')
        setBandejaNuevas((n) => n + 1)
        setTab('bandeja')
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabs = useMemo(() => {
    const porPagar = movimientos.filter((m) => m.estado === 'porPagar').length
    return TABS.map((t) => {
      // Los dos contadores del menú: mensajes del banco sin confirmar, y
      // cuentas por pagar. Son los que hacen que alguien entre.
      if (t.id === 'bandeja') return { ...t, badge: bandejaNuevas }
      if (t.id === 'movimientos') return { ...t, badge: porPagar }
      return t
    })
  }, [movimientos, bandejaNuevas])

  const actual = tabs.find((t) => t.id === tab)

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        /* modo incógnito o storage lleno: la preferencia solo no se guarda */
      }
      return next
    })
  }

  // El subtítulo del header cambia según dónde estés.
  const subtitulo = useMemo(() => {
    if (tab === 'resumen') return `Tus finanzas · ${etiquetaMes(mes)}`
    if (tab === 'movimientos') return 'Cada gasto e ingreso, con su recibo y su historia'
    if (tab === 'presupuesto') return `Lo que quieres gastar contra lo que llevas · ${etiquetaMes(mes)}`
    if (tab === 'bandeja') return 'Lo que avisó el banco, listo para confirmar'
    if (tab === 'cuentas') return 'Tus tarjetas y cuentas, y cuánto se mueve por cada una'
    return ''
  }, [tab, mes])

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <Sidebar
        tabs={tabs}
        active={tab}
        onSelect={(id) => {
          setTab(id)
          setMobileNavOpen(false)
        }}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className="app-main">
        <Header
          title={actual?.label ?? 'Resumen'}
          subtitle={subtitulo}
          onToggleNav={() => setMobileNavOpen((v) => !v)}
          // El selector de mes solo tiene sentido donde hay un mes que elegir.
          conMes={tab === 'resumen' || tab === 'movimientos' || tab === 'presupuesto'}
        />
        <main className="app-content">
          {tab === 'resumen' && <Resumen onNavegar={setTab} />}
          {tab === 'movimientos' && <Movimientos />}
          {tab === 'presupuesto' && <Presupuesto />}
          {tab === 'bandeja' && <Bandeja />}
          {tab === 'cuentas' && <Cuentas />}
        </main>
      </div>
    </div>
  )
}
