import { dinero } from '../../lib/format'

// Piezas que se repiten en todas las vistas. Están juntas a propósito: son
// envoltorios de pocas líneas y tenerlas en un archivo evita catorce imports.

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

// Ficha de indicador. `tono` pinta el valor (bien / ojo / mal) y `pie` es la
// línea chica de abajo, donde va el contexto que le da sentido al número.
export function Kpi({ label, value, pie, tono, icono, color }) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icono && (
          <span className="kpi-icon" style={color ? { background: tint(color, 0.14), color } : undefined}>
            {icono}
          </span>
        )}
      </div>
      <div className={`kpi-value ${tono ? `is-${tono}` : ''}`}>{value}</div>
      {pie && <div className="kpi-pie">{pie}</div>}
    </div>
  )
}

// Etiqueta de variación contra el mes anterior. Sube = rojo (se gastó más),
// baja = verde. Es gasto, no ingreso: subir es la mala noticia.
export function Delta({ v }) {
  if (!v) return <span className="delta is-flat">sin comparación</span>
  const clase = v.cambio > 0.001 ? 'is-up' : v.cambio < -0.001 ? 'is-down' : 'is-flat'
  return <span className={`delta ${clase}`}>{v.texto}</span>
}

export function Pill({ color, children }) {
  return (
    <span className="pill" style={{ background: tint(color, 0.13), color }}>
      {children}
    </span>
  )
}

// Barra de proporción para las tablas de categorías y conceptos.
export function Barra({ fraccion, color }) {
  return (
    <div className="barra">
      <div
        className="barra-fill"
        style={{ width: `${Math.max(2, Math.min(100, fraccion * 100))}%`, background: color }}
      />
    </div>
  )
}

export function Vacio({ children }) {
  return <p className="vacio">{children}</p>
}

export function Cargando({ children = 'Cargando…' }) {
  return (
    <div className="pantalla-estado">
      <div className="spinner" />
      <p>{children}</p>
    </div>
  )
}

export function ErrorAviso({ mensaje, onReintentar }) {
  return (
    <div className="pantalla-estado">
      <p>⚠️ {mensaje}</p>
      {onReintentar && (
        <button className="btn btn-primary" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  )
}

// Tooltip de las gráficas. El de Recharts por defecto no respeta la tipografía
// ni el formato de moneda, así que se dibuja aquí.
export function TooltipGrafica({ active, payload, label, totalizar = false }) {
  if (!active || !payload?.length) return null
  const filas = payload.filter((p) => (p.value ?? 0) !== 0)
  if (!filas.length) return null
  const total = filas.reduce((a, p) => a + (p.value ?? 0), 0)
  return (
    <div className="tooltip">
      <div className="tooltip-title">{label}</div>
      {filas.map((p) => (
        <div className="tooltip-row" key={p.dataKey ?? p.name}>
          <i style={{ background: p.color ?? p.fill }} />
          <span className="tooltip-name">{p.name}</span>
          <span className="tooltip-value">{dinero(p.value)}</span>
        </div>
      ))}
      {totalizar && filas.length > 1 && (
        <div className="tooltip-row is-total">
          <span className="tooltip-name">Total</span>
          <span className="tooltip-value">{dinero(total)}</span>
        </div>
      )}
    </div>
  )
}


// rgba a partir de un hex, para fondos tenues. Se hace a mano en vez de con
// color-mix porque no todos los navegadores de la casa lo soportan.
export function tint(hex, alpha) {
  const h = String(hex || '#94a3b8').replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  if (!Number.isFinite(n)) return `rgba(148, 163, 184, ${alpha})`
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// El mismo color mezclado con blanco, en OPACO. `tint` no sirve para el ítem
// activo del menú: sobre el azul oscuro del sidebar, un rgba deja pasar el
// fondo y el color sale sucio y sin contraste. Esto devuelve el tono pastel de
// verdad, que es lo que hace que la casa activa resalte contra el rail.
export function aclarar(hex, cantidad) {
  const h = String(hex || '#94a3b8').replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  if (!Number.isFinite(n)) return '#f1f5f9'
  const mezclar = (c) => Math.round(c + (255 - c) * cantidad)
  return `rgb(${mezclar((n >> 16) & 255)}, ${mezclar((n >> 8) & 255)}, ${mezclar(n & 255)})`
}
