import { CATEGORIA_POR_ID } from './categorias.js'

// Todo lo que las vistas saben de los movimientos se deriva AQUÍ, cada vez
// que se mira. Nada se guarda pre-calculado: un total y su detalle nunca
// deben poder decir cosas distintas.
//
// Regla de oro de los totales: suman los movimientos REGISTRADOS y solo
// ellos. Un "por pagar" todavía no salió del bolsillo y un anulado no
// existió; los dos se ven en sus listas, pero no mueven ninguna cifra.

// El mes de la app es un string "2026-09". El de un movimiento sale de su
// fecha (el día del gasto, no el de creación: un gasto del 31 de agosto
// registrado el 2 de septiembre es gasto de agosto).
export const mesDe = (mov) => (mov.fecha ? mov.fecha.slice(0, 7) : null)

// El mes de HOY, en la zona de quien mira. `toISOString().slice(0,7)` sería
// el mes en UTC, y la noche del 30 ya sería "el mes que viene".
export function mesActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function hoyDia() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function nombreMes(mes, corto = false) {
  const m = Number(String(mes ?? '').slice(5, 7))
  if (!m) return ''
  const nombre = MESES[m - 1] ?? ''
  const capital = nombre.charAt(0).toUpperCase() + nombre.slice(1)
  return corto ? capital.slice(0, 3) : capital
}

export function etiquetaMes(mes, conAnio = true) {
  if (!mes) return ''
  return conAnio ? `${nombreMes(mes)} ${mes.slice(0, 4)}` : nombreMes(mes)
}

// Los meses del selector: todos los que tengan algún movimiento, más el mes
// en curso aunque esté vacío —la app abre en hoy, no en el último mes con
// datos de hace tres—. Más nuevo primero.
export function mesesConDatos(movimientos) {
  const set = new Set([mesActual()])
  for (const m of movimientos) {
    const mes = mesDe(m)
    if (mes) set.add(mes)
  }
  return [...set].sort().reverse()
}

const esGastoVivo = (m) => m.estado === 'registrado' && m.tipo === 'gasto'
const esIngresoVivo = (m) => m.estado === 'registrado' && m.tipo === 'ingreso'

export function gastosDelMes(movimientos, mes) {
  return movimientos.filter((m) => esGastoVivo(m) && mesDe(m) === mes)
}

export function ingresosDelMes(movimientos, mes) {
  return movimientos.filter((m) => esIngresoVivo(m) && mesDe(m) === mes)
}

export const sumar = (movs) => movs.reduce((a, m) => a + (m.montoEur ?? 0), 0)

// Gasto del mes agrupado por categoría, listo para la dona y las barras:
// [{id, label, color, total, n}], de mayor a menor.
export function porCategoria(movs) {
  const mapa = new Map()
  for (const m of movs) {
    const id = m.categoria ?? 'otros'
    const fila = mapa.get(id) ?? { id, total: 0, n: 0 }
    fila.total += m.montoEur ?? 0
    fila.n += 1
    mapa.set(id, fila)
  }
  return [...mapa.values()]
    .map((f) => ({
      ...f,
      label: CATEGORIA_POR_ID[f.id]?.label ?? f.id,
      color: CATEGORIA_POR_ID[f.id]?.color ?? '#94a3b8',
    }))
    .sort((a, b) => b.total - a.total)
}

// La serie de los últimos `n` meses hasta `mesHasta` incluido, con gasto e
// ingreso por mes. Incluye los meses en cero: una gráfica que se salta un mes
// vacío miente sobre el ritmo.
export function tendencia(movimientos, mesHasta, n = 6) {
  if (!mesHasta) return []
  const [a, m] = mesHasta.split('-').map(Number)
  const meses = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(a, m - 1 - i, 15)
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const porMes = new Map(meses.map((mes) => [mes, { mes, label: nombreMes(mes, true), gasto: 0, ingreso: 0 }]))
  for (const mov of movimientos) {
    const fila = porMes.get(mesDe(mov))
    if (!fila || mov.estado !== 'registrado') continue
    if (mov.tipo === 'gasto') fila.gasto += mov.montoEur ?? 0
    else fila.ingreso += mov.montoEur ?? 0
  }
  return [...porMes.values()]
}

// El presupuesto contra lo gastado, fila por fila. `presupuesto` es el mapa
// {categoria: euros} del mes; `gastos` los movimientos ya filtrados al mes.
// Salen también las categorías con gasto pero sin presupuesto (presupuestado
// 0): esconderlas haría que el total gastado y la suma de filas discrepen.
export function presupuestoVsGasto(porCategoriaPresupuesto, gastos) {
  const gastado = new Map(porCategoria(gastos).map((f) => [f.id, f]))
  const ids = new Set([...Object.keys(porCategoriaPresupuesto ?? {}), ...gastado.keys()])
  return [...ids]
    .map((id) => {
      const p = porCategoriaPresupuesto?.[id] ?? 0
      const g = gastado.get(id)?.total ?? 0
      return {
        id,
        label: CATEGORIA_POR_ID[id]?.label ?? id,
        color: CATEGORIA_POR_ID[id]?.color ?? '#94a3b8',
        presupuestado: p,
        gastado: g,
        restante: p - g,
      }
    })
    .sort((x, y) => y.presupuestado - x.presupuestado || y.gastado - x.gastado)
}

export const totalPresupuesto = (porCat) =>
  Object.values(porCat ?? {}).reduce((a, v) => a + (Number(v) || 0), 0)
