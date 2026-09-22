import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useSesion } from '../../auth/Sesion'
import { Card, Cargando, ErrorAviso, Kpi, Vacio } from '../common/Ui'
import Icono from '../common/Iconos'
import { diaDe, dinero } from '../../lib/format'
import { normalizar } from '../../lib/categorias'
import { etiquetaMes, gastosDelMes, ingresosDelMes, mesDe, sumar } from '../../lib/calculos'
import NuevoMovimiento from './NuevoMovimiento'
import MovimientoDetalle from './MovimientoDetalle'
import { BarraTasa } from './Tasa'
import { MovFila } from './piezas'

// LA LISTA DE MOVIMIENTOS.
//
// Abre en los gastos del mes elegido en el header, que es la pregunta que se
// trae al entrar: "¿en qué se me fue el mes?". Los por pagar no tienen mes
// —todavía no pasaron— así que su pestaña ignora el selector.

const FILTROS = [
  { id: 'gastos', label: 'Gastos' },
  { id: 'ingresos', label: 'Ingresos' },
  { id: 'porPagar', label: 'Por pagar' },
  { id: 'anulados', label: 'Anulados' },
]

export default function Movimientos() {
  const { movimientos, cuentas, cargando, error, recargar, mes } = useApp()
  const { puedeEscribir } = useSesion()
  const [filtro, setFiltro] = useState('gastos')
  const [cuenta, setCuenta] = useState('todas')
  // El buscador. Se guarda lo tecleado tal cual y se normaliza al comparar.
  const [busqueda, setBusqueda] = useState('')
  const [dia, setDia] = useState('')
  const [creando, setCreando] = useState(false)
  const [abierto, setAbierto] = useState(null)

  const porCuenta = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas])

  // Por texto se mira el título, el detalle y la categoría: los tres datos
  // que se leen en la fila. Sin acentos ni mayúsculas. Por fecha entra el
  // movimiento si su fecha, su "para cuándo" o su día de registro caen ese
  // día: quien busca "el 5" no está pensando en cuál de las tres.
  const coincide = useMemo(() => {
    const texto = normalizar(busqueda)
    return (m) => {
      if (texto) {
        const donde = normalizar([m.titulo, m.descripcion, m.categoria].filter(Boolean).join(' '))
        if (!donde.includes(texto)) return false
      }
      if (dia) {
        const dias = [m.fecha, m.paraCuando, diaDe(m.creadoEl)]
        if (!dias.includes(dia)) return false
      }
      return true
    }
  }, [busqueda, dia])

  const buscando = Boolean(busqueda.trim() || dia)

  // Qué deja pasar cada pestaña. Los registrados se recortan al mes del
  // header; por pagar y anulados no, porque no viven en un mes.
  const pasaFiltro = useMemo(() => {
    return (m) => {
      if (filtro === 'gastos') return m.estado === 'registrado' && m.tipo === 'gasto' && mesDe(m) === mes
      if (filtro === 'ingresos') return m.estado === 'registrado' && m.tipo === 'ingreso' && mesDe(m) === mes
      if (filtro === 'porPagar') return m.estado === 'porPagar'
      if (filtro === 'anulados') return m.estado === 'anulado'
      return true
    }
  }, [filtro, mes])

  // Los números de los chips cuentan sobre lo que la búsqueda y la cuenta
  // dejan pasar: si dicen "Ingresos 3" y al pulsar salen dos, el que miente
  // es el número.
  const cuentasChips = useMemo(() => {
    const base = movimientos.filter((m) => (cuenta === 'todas' || m.cuenta === cuenta) && coincide(m))
    const n = { gastos: 0, ingresos: 0, porPagar: 0, anulados: 0 }
    for (const m of base) {
      if (m.estado === 'porPagar') n.porPagar++
      else if (m.estado === 'anulado') n.anulados++
      else if (m.tipo === 'ingreso') { if (mesDe(m) === mes) n.ingresos++ }
      else if (mesDe(m) === mes) n.gastos++
    }
    return n
  }, [movimientos, cuenta, coincide, mes])

  const resumen = useMemo(() => {
    const gastos = gastosDelMes(movimientos, mes)
    const ingresos = ingresosDelMes(movimientos, mes)
    const porPagar = movimientos.filter((m) => m.estado === 'porPagar')
    return {
      gastado: sumar(gastos),
      nGastos: gastos.length,
      ingresado: sumar(ingresos),
      porPagar: porPagar.length,
      // Solo suma los que traen monto: inventar los que no lo tienen daría
      // un número que parece exacto y no lo es.
      estimadoPorPagar: sumar(porPagar.filter((m) => m.montoEur != null)),
      sinMonto: porPagar.filter((m) => m.montoEur == null).length,
    }
  }, [movimientos, mes])

  const lista = useMemo(() => {
    let l = movimientos.filter(pasaFiltro)
    if (cuenta !== 'todas') l = l.filter((m) => m.cuenta === cuenta)
    l = l.filter(coincide)
    // Los registrados, del más reciente al más viejo por fecha del gasto.
    // Los por pagar al revés: primero lo que lleva más esperando.
    return [...l].sort((a, b) =>
      filtro === 'porPagar'
        ? a.creadoEl.localeCompare(b.creadoEl)
        : (b.fecha ?? b.creadoEl).localeCompare(a.fecha ?? a.creadoEl),
    )
  }, [movimientos, pasaFiltro, cuenta, coincide, filtro])

  const movAbierto = abierto ? movimientos.find((m) => m.id === abierto) : null

  if (cargando) return <Cargando>Cargando los movimientos…</Cargando>
  if (error) return <ErrorAviso mensaje={error} onReintentar={recargar} />

  return (
    <div className="vista">
      <div className="kpi-row">
        <Kpi
          label={`Gastado en ${etiquetaMes(mes, false).toLowerCase()}`}
          value={dinero(resumen.gastado)}
          icono={<Icono name="cartera" size={16} />}
          color="#4f46e5"
          pie={<span className="kpi-pie-extra">{resumen.nGastos} gastos registrados</span>}
        />
        <Kpi
          label="Ingresos del mes"
          value={dinero(resumen.ingresado)}
          icono={<Icono name="grafica" size={16} />}
          color="#16a34a"
          pie={<span className="kpi-pie-extra">lo que entró este mes</span>}
        />
        <Kpi
          label="Por pagar"
          value={String(resumen.porPagar)}
          tono={resumen.porPagar > 0 ? 'ojo' : undefined}
          icono={<Icono name="reloj" size={16} />}
          color="#f59e0b"
          pie={
            <span className="kpi-pie-extra">
              {resumen.porPagar === 0
                ? 'nada pendiente'
                : `≈ ${dinero(resumen.estimadoPorPagar)}${resumen.sinMonto ? ` · ${resumen.sinMonto} sin monto` : ''}`}
            </span>
          }
        />
      </div>

      {/* A cuánto están el euro y el dólar hoy. Va antes de la lista porque
          los montos de abajo no se entienden sin ellas. */}
      <BarraTasa />

      <Card
        title="Movimientos"
        subtitle="Cada gasto e ingreso, con su recibo y su historia"
        action={
          puedeEscribir && (
            <button className="btn btn-primary" onClick={() => setCreando(true)}>
              <Icono name="mas" size={16} /> Registrar
            </button>
          )
        }
      >
        <div className="buscador">
          <input
            type="search"
            className="buscador-texto"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, detalle o categoría"
            aria-label="Buscar movimientos"
          />
          <input
            type="date"
            className="buscador-dia"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            aria-label="Buscar por fecha"
          />
          {buscando && (
            <button type="button" className="filtro buscador-limpiar" onClick={() => { setBusqueda(''); setDia('') }}>
              <Icono name="equis" size={14} /> Limpiar
            </button>
          )}
        </div>

        <div className="filtros">
          <div className="filtros-grupo">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                className={`filtro ${filtro === f.id ? 'is-activo' : ''}`}
                onClick={() => setFiltro(f.id)}
              >
                {f.label}
                <span className="filtro-n">{cuentasChips[f.id] ?? 0}</span>
              </button>
            ))}
          </div>
          {cuentas.length > 0 && (
            <div className="filtros-grupo">
              <button
                className={`filtro ${cuenta === 'todas' ? 'is-activo' : ''}`}
                onClick={() => setCuenta('todas')}
              >
                Todas
              </button>
              {cuentas.filter((c) => !c.archivada).map((c) => (
                <button
                  key={c.id}
                  className={`filtro ${cuenta === c.id ? 'is-activo' : ''}`}
                  style={cuenta === c.id ? { background: c.color, borderColor: c.color, color: '#fff' } : undefined}
                  onClick={() => setCuenta(c.id)}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
          )}
        </div>

        {lista.length === 0 ? (
          <Vacio>
            {/* Que no haya nada por pagar es una buena noticia; que la
                búsqueda no encuentre nada es otra cosa distinta. */}
            {buscando
              ? 'Ningún movimiento coincide con lo que buscas. Prueba con menos palabras, o quita la fecha.'
              : filtro === 'porPagar'
                ? 'No hay nada pendiente por pagar. '
                : filtro === 'gastos'
                  ? `Todavía no hay gastos en ${etiquetaMes(mes).toLowerCase()}. El botón "Registrar" es el camino.`
                  : filtro === 'ingresos'
                    ? `No hay ingresos registrados en ${etiquetaMes(mes).toLowerCase()}.`
                    : 'No hay movimientos anulados.'}
          </Vacio>
        ) : (
          <div className="ticket-lista">
            {lista.map((m) => (
              <MovFila key={m.id} mov={m} cuenta={porCuenta.get(m.cuenta)} onAbrir={() => setAbierto(m.id)} />
            ))}
          </div>
        )}
      </Card>

      {creando && (
        <NuevoMovimiento
          onCerrar={() => setCreando(false)}
          onCreado={(m) => setAbierto(m.id)}
        />
      )}

      {movAbierto && (
        <MovimientoDetalle
          mov={movAbierto}
          cuenta={porCuenta.get(movAbierto.cuenta)}
          onCerrar={() => setAbierto(null)}
        />
      )}
    </div>
  )
}
