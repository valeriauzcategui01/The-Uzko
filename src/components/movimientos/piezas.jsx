import Icono from '../common/Iconos'
import { tint } from '../common/Ui'
import { categoriaColor, categoriaLabel } from '../../config'
import { diaCorto, dinero, montoOriginal } from '../../lib/format'

// Piezas chicas compartidas entre la lista, el detalle y el resumen.

export function CategoriaChip({ categoria }) {
  if (!categoria) return null
  return (
    <span
      className="chip"
      style={{ background: tint(categoriaColor(categoria), 0.13), color: categoriaColor(categoria) }}
    >
      {categoriaLabel(categoria)}
    </span>
  )
}

export const ETIQUETA_ESTADO = {
  registrado: 'Registrado',
  porPagar: 'Por pagar',
  anulado: 'Anulado',
}

// Los estilos de estado reusan las clases del sistema visual heredado
// (pendiente/pagado/cancelado), que ya pintan amarillo/verde/gris.
const CLASE_ESTADO = { registrado: 'pagado', porPagar: 'pendiente', anulado: 'cancelado' }

export function EstadoPill({ estado }) {
  return <span className={`estado-pill es-${CLASE_ESTADO[estado] ?? estado}`}>{ETIQUETA_ESTADO[estado] ?? estado}</span>
}

// Una fila de la lista. Muestra lo que se necesita para decidir si abrirla:
// qué fue, de qué categoría, de qué cuenta salió, cuándo y cuánto.
export function MovFila({ mov, cuenta, onAbrir }) {
  const original = montoOriginal(mov.original)
  const adjuntos = mov.adjuntos?.length ?? 0
  const esIngreso = mov.tipo === 'ingreso'

  return (
    <button className={`ticket-fila es-${CLASE_ESTADO[mov.estado] ?? mov.estado}`} onClick={onAbrir}>
      <span
        className="ticket-franja"
        style={{ background: esIngreso ? '#16a34a' : categoriaColor(mov.categoria) }}
      />

      <span className="ticket-cuerpo">
        <span className="ticket-linea1">
          <span className="ticket-num">#{mov.numero}</span>
          <span className="ticket-titulo">{mov.titulo}</span>
          {adjuntos > 0 && (
            <span className="ticket-clip" title={`${adjuntos} recibo${adjuntos > 1 ? 's' : ''}`}>
              <Icono name="clip" size={13} />
              {adjuntos}
            </span>
          )}
        </span>
        <span className="ticket-linea2">
          <CategoriaChip categoria={mov.categoria} />
          {cuenta && (
            <span style={{ color: cuenta.color }}>{cuenta.nombre}</span>
          )}
          <span className="ticket-sep">·</span>
          {/* En un registrado manda la fecha del gasto; en un por pagar, para
              cuándo se necesita. */}
          <span>{mov.estado === 'porPagar' ? (mov.paraCuando ? `para el ${diaCorto(mov.paraCuando)}` : 'sin fecha límite') : diaCorto(mov.fecha)}</span>
          {mov.origen === 'bandeja' && (
            <>
              <span className="ticket-sep">·</span>
              <span title="Nació de un mensaje del banco">del banco</span>
            </>
          )}
        </span>
      </span>

      <span className="ticket-derecha">
        <span className="ticket-cifras">
          <span className={`ticket-monto ${esIngreso ? 'es-real' : ''}`}>
            {mov.montoEur != null ? `${esIngreso ? '+' : ''}${dinero(mov.montoEur)}` : '—'}
          </span>
          {/* Debajo del euro, lo que se pagó de verdad en su moneda: es lo que
              distingue "gasté 23 €" de "gasté Bs 1.250 que hoy son 23 €". */}
          {original && <span className="ticket-monto-bs">{original}</span>}
        </span>
        <EstadoPill estado={mov.estado} />
      </span>
    </button>
  )
}
