import { useState } from 'react'
import { useSesion } from '../../auth/Sesion'
import { useApp } from '../../context/AppContext'
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO, categoriaColor } from '../../config'
import { bolivares, desde, dinero, dolares, fechaHora, fechaLarga, paraTeclear, tasaDia } from '../../lib/format'
import { hoyDia } from '../../lib/calculos'
import Icono from '../common/Iconos'
import { GaleriaAdjuntos, SelectorAdjuntos } from './Adjuntos'
import { CategoriaChip, EstadoPill } from './piezas'
import { CampoMonto } from './Tasa'

// El movimiento abierto: todo lo que se sabe de él y lo que se puede hacer.
//
// El historial va al final y completo, sin plegar: es la columna que permite
// responder "¿qué era esto y quién lo cambió?" seis meses después.
export default function MovimientoDetalle({ mov, cuenta, onCerrar }) {
  const { puedeEscribir } = useSesion()
  const { pagar, deshacerPago, editar, anular, reactivar, comentar } = useApp()
  const [panel, setPanel] = useState(null) // pagar | editar | anular
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const correr = async (fn) => {
    setOcupado(true)
    setErr('')
    try {
      await fn()
      setPanel(null)
    } catch (e) {
      setErr(e.message || 'No se pudo completar')
    } finally {
      setOcupado(false)
    }
  }

  const fuePendiente = mov.historial?.some((h) => h.tipo === 'pagado')

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal modal-ancho" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head" style={{ borderTopColor: categoriaColor(mov.categoria) }}>
          <div>
            <div className="detalle-super">
              <span className="detalle-num">#{mov.numero}</span>
              {mov.tipo === 'ingreso' && <span className="detalle-casa" style={{ color: '#16a34a' }}>Ingreso</span>}
              {cuenta && (
                <span className="detalle-casa" style={{ color: cuenta.color }}>
                  {cuenta.nombre}
                </span>
              )}
              <EstadoPill estado={mov.estado} />
              <CategoriaChip categoria={mov.categoria} />
            </div>
            <h2>{mov.titulo}</h2>
          </div>
          <button className="modal-cerrar" onClick={onCerrar} title="Cerrar">×</button>
        </header>

        <div className="modal-cuerpo">
          <div className="detalle-datos">
            {mov.montoEur != null && (
              <div>
                <span className="dato-label">{mov.estado === 'porPagar' ? 'Monto estimado' : mov.tipo === 'ingreso' ? 'Entró' : 'Costó'}</span>
                <span className="dato-valor">{dinero(mov.montoEur)}</span>
                {/* Si se pagó en otra moneda, la cifra de verdad es esa y el
                    euro es la conversión. Se enseñan las dos, con la tasa que
                    se usó: es la única forma de que el número se pueda
                    comprobar meses después. */}
                <EnSuMoneda original={mov.original} />
              </div>
            )}
            {mov.fecha && (
              <div>
                <span className="dato-label">Fecha</span>
                <span className="dato-valor">{fechaLarga(mov.fecha)}</span>
              </div>
            )}
            {mov.estado === 'porPagar' && (
              <div>
                <span className="dato-label">Para cuándo</span>
                <span className="dato-valor">{mov.paraCuando ? fechaLarga(mov.paraCuando) : 'Sin fecha límite'}</span>
              </div>
            )}
            <div>
              <span className="dato-label">Lo registró</span>
              <span className="dato-valor">{mov.creadoPor?.nombre ?? '—'}</span>
              <span className="dato-pie" title={fechaHora(mov.creadoEl)}>
                {desde(mov.creadoEl)}
                {mov.origen === 'bandeja' ? ' · desde el banco' : ''}
              </span>
            </div>
          </div>

          {mov.descripcion && <p className="detalle-desc">{mov.descripcion}</p>}

          {mov.anulacion && (
            <div className="bloque-cancelado">
              <span className="dato-label">Anulado por {mov.anulacion.por?.nombre ?? '—'}</span>
              <p>{mov.anulacion.motivo}</p>
            </div>
          )}

          <GaleriaAdjuntos adjuntos={mov.adjuntos} />

          {/* ── acciones ── */}
          {!panel && puedeEscribir && (
            <div className="detalle-acciones">
              {mov.estado === 'porPagar' && (
                <button className="btn btn-primary" onClick={() => setPanel('pagar')}>
                  <Icono name="check" size={16} /> Ya lo pagué
                </button>
              )}
              {mov.estado !== 'anulado' && (
                <button className="btn btn-ghost" onClick={() => setPanel('editar')}>
                  <Icono name="lapiz" size={16} /> Editar
                </button>
              )}
              {mov.estado === 'registrado' && fuePendiente && (
                <button className="btn btn-ghost" onClick={() => correr(() => deshacerPago(mov.id))} disabled={ocupado}>
                  <Icono name="deshacer" size={16} /> Deshacer el pago
                </button>
              )}
              {mov.estado !== 'anulado' && (
                <button className="btn btn-ghost" onClick={() => setPanel('anular')}>
                  <Icono name="equis" size={16} /> Anular
                </button>
              )}
              {mov.estado === 'anulado' && (
                <button className="btn btn-ghost" onClick={() => correr(() => reactivar(mov.id))} disabled={ocupado}>
                  <Icono name="deshacer" size={16} /> Reactivar
                </button>
              )}
            </div>
          )}

          {panel === 'pagar' && (
            <FormularioPago
              mov={mov}
              ocupado={ocupado}
              onCancelar={() => setPanel(null)}
              onEnviar={(d) => correr(() => pagar(mov.id, d))}
            />
          )}

          {panel === 'editar' && (
            <FormularioEditar
              mov={mov}
              ocupado={ocupado}
              onCancelar={() => setPanel(null)}
              onEnviar={(d) => correr(() => editar(mov.id, d))}
            />
          )}

          {panel === 'anular' && (
            <FormularioAnular
              ocupado={ocupado}
              onCancelar={() => setPanel(null)}
              onEnviar={(d) => correr(() => anular(mov.id, d))}
            />
          )}

          {err && <p className="campo-error">⚠️ {err}</p>}

          {/* ── historial ── */}
          <div className="historial">
            <h3 className="historial-titulo">Historial</h3>
            <ul>
              {[...mov.historial].reverse().map((h, i) => (
                <li key={i} className={`historial-item es-${h.tipo}`}>
                  <span className="historial-punto" />
                  <div>
                    <p>
                      <strong>{h.por?.nombre ?? '—'}</strong> · {h.texto}
                    </p>
                    <span className="dato-pie" title={fechaHora(h.el)}>{desde(h.el)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {puedeEscribir && (
            <CajaComentario onEnviar={(d) => correr(() => comentar(mov.id, d))} ocupado={ocupado} />
          )}
        </div>
      </div>
    </div>
  )
}

// La cifra tal como se tecleó, con la tasa que la convirtió. En euros no se
// enseña nada: el euro ya está arriba y repetirlo no añade nada.
function EnSuMoneda({ original }) {
  if (!original) return null
  const { moneda, valor, tasa } = original
  return (
    <span className="dato-pie">
      {moneda === 'bs' ? bolivares(valor) : dolares(valor)}
      {tasa?.eur != null && ` · con el euro a ${tasaDia(tasa.eur)} (${tasa.dia})`}
    </span>
  )
}

function FormularioPago({ mov, onEnviar, onCancelar, ocupado }) {
  // Arranca con el monto estimado y en la moneda en que se anotó: casi
  // siempre es lo que se acaba pagando, y corregirlo es más rápido que
  // escribirlo desde cero. Pero quien paga declara en qué MOVIÓ el dinero,
  // así que el selector queda abierto.
  const [moneda, setMoneda] = useState(mov.original?.moneda ?? 'eur')
  const [cuanto, setCuanto] = useState(paraTeclear(mov.original?.valor ?? mov.montoEur))
  const [fecha, setFecha] = useState(hoyDia())
  const [adjuntos, setAdjuntos] = useState([])

  return (
    <form
      className="panel-accion"
      onSubmit={(e) => {
        e.preventDefault()
        // El servidor recibe la cifra tal como se tecleó y en qué moneda: la
        // conversión la hace él, con la tasa del día de verdad y no con la
        // que tenga esta pestaña, que puede llevar horas abierta.
        onEnviar({ monto: cuanto, moneda, fecha, adjuntos })
      }}
    >
      <h3 className="panel-titulo">Registrar el pago</h3>
      <CampoMonto label="Cuánto se pagó" valor={cuanto} onValor={setCuanto} moneda={moneda} onMoneda={setMoneda} autoFocus />
      <label className="campo">
        <span className="campo-label">Fecha del pago</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>

      <SelectorAdjuntos valor={adjuntos} onCambio={setAdjuntos} etiqueta="Adjuntar comprobante" />

      <div className="panel-pie">
        <button type="button" className="btn btn-ghost" onClick={onCancelar}>
          Volver
        </button>
        <button className="btn btn-primary" disabled={ocupado || !cuanto.trim()}>
          {ocupado ? 'Guardando…' : 'Confirmar pago'}
        </button>
      </div>
    </form>
  )
}

// CORREGIR EL MOVIMIENTO.
//
// Los mismos campos que al registrarlo, ya rellenos con lo que dice ahora,
// menos los adjuntos: un recibo no se corrige, se añade otro por el
// comentario, y quitar el que ya estaba borraría la prueba.
function FormularioEditar({ mov, onEnviar, onCancelar, ocupado }) {
  const { cuentas } = useApp()
  const [titulo, setTitulo] = useState(mov.titulo ?? '')
  const [categoria, setCategoria] = useState(mov.categoria ?? '')
  const [cuenta, setCuenta] = useState(mov.cuenta ?? '')
  const [descripcion, setDescripcion] = useState(mov.descripcion ?? '')
  const [fecha, setFecha] = useState(mov.fecha ?? '')
  const [paraCuando, setParaCuando] = useState(mov.paraCuando ?? '')
  // El monto arranca en la moneda en que se tecleó y con la cifra de
  // entonces, no con su conversión: quien vuelve a abrir esto para corregir
  // espera ver lo que escribió.
  const [moneda, setMoneda] = useState(mov.original?.moneda ?? 'eur')
  const [monto, setMonto] = useState(paraTeclear(mov.original?.valor ?? mov.montoEur))

  const categorias = mov.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO
  const visibles = cuentas.filter((c) => !c.archivada || c.id === mov.cuenta)

  return (
    <form
      className="panel-accion"
      onSubmit={(e) => {
        e.preventDefault()
        onEnviar({ titulo, categoria, cuenta, descripcion, fecha, paraCuando, monto, moneda })
      }}
    >
      <h3 className="panel-titulo">Corregir el movimiento</h3>
      <p className="panel-aviso">Lo que cambies queda escrito en el historial, con lo que decía antes.</p>

      <label className="campo">
        <span className="campo-label">{mov.tipo === 'ingreso' ? '¿Qué entró?' : '¿Qué se pagó?'}</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
      </label>

      <div className="campo-fila">
        <label className="campo">
          <span className="campo-label">¿De qué es?</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Escoge una categoría…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {mov.estado === 'porPagar' ? (
          <label className="campo">
            <span className="campo-label">
              ¿Para cuándo? <span className="campo-opcional">opcional</span>
            </span>
            <input type="date" value={paraCuando} onChange={(e) => setParaCuando(e.target.value)} />
          </label>
        ) : (
          <label className="campo">
            <span className="campo-label">Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
        )}
      </div>

      <CampoMonto
        label={mov.estado === 'porPagar' ? 'Monto estimado' : 'Cuánto fue'}
        opcional={mov.estado === 'porPagar'}
        valor={monto}
        onValor={setMonto}
        moneda={moneda}
        onMoneda={setMoneda}
      />

      {visibles.length > 0 && (
        <label className="campo">
          <span className="campo-label">
            Cuenta o tarjeta <span className="campo-opcional">opcional</span>
          </span>
          <div className="chips-casa">
            {visibles.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip-casa ${cuenta === c.id ? 'is-activa' : ''}`}
                style={cuenta === c.id ? { background: c.color, borderColor: c.color } : { borderColor: c.color, color: c.color }}
                onClick={() => setCuenta(cuenta === c.id ? '' : c.id)}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </label>
      )}

      <label className="campo">
        <span className="campo-label">
          Detalle <span className="campo-opcional">opcional</span>
        </span>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} maxLength={2000} />
      </label>

      <div className="panel-pie">
        <button type="button" className="btn btn-ghost" onClick={onCancelar}>
          Volver
        </button>
        <button className="btn btn-primary" disabled={ocupado || !titulo.trim() || !categoria}>
          {ocupado ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

function FormularioAnular({ onEnviar, onCancelar, ocupado }) {
  const [motivo, setMotivo] = useState('')
  return (
    <form
      className="panel-accion"
      onSubmit={(e) => {
        e.preventDefault()
        onEnviar({ motivo })
      }}
    >
      <h3 className="panel-titulo">Anular el movimiento</h3>
      <p className="panel-aviso">
        Anular no borra: el movimiento queda en la lista de anulados, con su historia, pero deja de
        sumar en los totales.
      </p>
      <label className="campo">
        <span className="campo-label">¿Por qué?</span>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Estaba repetido"
          autoFocus
          maxLength={500}
        />
      </label>
      <div className="panel-pie">
        <button type="button" className="btn btn-ghost" onClick={onCancelar}>
          Volver
        </button>
        <button className="btn btn-peligro" disabled={ocupado || !motivo.trim()}>
          {ocupado ? 'Anulando…' : 'Anular'}
        </button>
      </div>
    </form>
  )
}

function CajaComentario({ onEnviar, ocupado }) {
  const [texto, setTexto] = useState('')
  const [adjuntos, setAdjuntos] = useState([])
  const vacio = !texto.trim() && !adjuntos.length

  return (
    <form
      className="caja-comentario"
      onSubmit={(e) => {
        e.preventDefault()
        onEnviar({ texto, adjuntos })
        setTexto('')
        setAdjuntos([])
      }}
    >
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe una nota o adjunta otro recibo…"
        rows={2}
        maxLength={1000}
      />
      <div className="caja-comentario-pie">
        <SelectorAdjuntos valor={adjuntos} onCambio={setAdjuntos} etiqueta="Adjuntar" />
        <button className="btn btn-primary btn-sm" disabled={ocupado || vacio}>
          Comentar
        </button>
      </div>
    </form>
  )
}
