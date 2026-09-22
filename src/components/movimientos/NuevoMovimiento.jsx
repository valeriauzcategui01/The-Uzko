import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO } from '../../config'
import { hoyDia } from '../../lib/calculos'
import { SelectorAdjuntos } from './Adjuntos'
import { CampoMonto } from './Tasa'

// Registrar un movimiento.
//
// Lo normal es un gasto que YA pasó: se pagó el mercado, llegó el SMS del
// banco, hay un ticket que fotografiar. Por eso el formulario abre en
// "Gasto" con la fecha de hoy y el monto como protagonista. "Por pagar" es
// el modo para lo que vence después (el alquiler, la factura), y "Ingreso"
// para lo que entra.
//
// `prefill` viene de la bandeja o del "Compartir a Uzko": el SMS del banco ya
// parseado. Todo lo que trae se puede corregir antes de guardar — el parser
// propone, la persona decide.

const MODOS = [
  { id: 'gasto', label: 'Gasto' },
  { id: 'ingreso', label: 'Ingreso' },
  { id: 'porPagar', label: 'Por pagar' },
]

export default function NuevoMovimiento({ onCerrar, onCreado, prefill }) {
  const { cuentas, crear } = useApp()
  const [modo, setModo] = useState(prefill?.tipo === 'ingreso' ? 'ingreso' : 'gasto')
  const [titulo, setTitulo] = useState(prefill?.titulo ?? '')
  // Arranca vacía a propósito (salvo propuesta del parser): un valor por
  // defecto haría que la mitad de los gastos acabaran en la categoría que
  // tocara estar primera.
  const [categoria, setCategoria] = useState(prefill?.categoria ?? '')
  const [cuenta, setCuenta] = useState('')
  const [descripcion, setDescripcion] = useState(prefill?.descripcion ?? '')
  const [monto, setMonto] = useState(prefill?.monto ?? '')
  // En qué moneda se está tecleando. Arranca en euros, que es la moneda en
  // que se lleva la cuenta; el bolívar y el dólar están a un toque.
  const [moneda, setMoneda] = useState(prefill?.moneda ?? 'eur')
  const [fecha, setFecha] = useState(prefill?.fecha ?? hoyDia())
  const [paraCuando, setParaCuando] = useState('')
  const [adjuntos, setAdjuntos] = useState([])
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const esPorPagar = modo === 'porPagar'
  const tipo = modo === 'ingreso' ? 'ingreso' : 'gasto'
  const categorias = tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO
  const visibles = cuentas.filter((c) => !c.archivada)

  const cambiarModo = (id) => {
    setModo(id)
    // La categoría de gasto no vale para un ingreso ni al revés: se limpia
    // para que el guardado no falle con una mezcla que el selector ya no
    // muestra.
    const listaNueva = id === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO
    if (!listaNueva.some((c) => c.id === categoria)) setCategoria('')
  }

  const enviar = async (e) => {
    e.preventDefault()
    setOcupado(true)
    setErr('')
    try {
      // Se manda lo tecleado y en qué moneda; convertir es cosa del servidor,
      // que es quien tiene la tasa buena.
      const m = await crear({
        tipo,
        estado: esPorPagar ? 'porPagar' : 'registrado',
        titulo,
        categoria,
        cuenta,
        descripcion,
        monto,
        moneda,
        fecha,
        paraCuando,
        adjuntos,
        origen: prefill ? 'bandeja' : 'manual',
      })
      onCreado?.(m)
      onCerrar()
    } catch (e2) {
      setErr(e2.message || 'No se pudo guardar')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{esPorPagar ? 'Anotar algo por pagar' : tipo === 'ingreso' ? 'Registrar un ingreso' : 'Registrar un gasto'}</h2>
          <button className="modal-cerrar" onClick={onCerrar} title="Cerrar">×</button>
        </header>

        <form className="modal-cuerpo" onSubmit={enviar}>
          {prefill?.textoOriginal && (
            <p className="panel-aviso" title="Lo que llegó del banco, tal cual">
              📩 {prefill.textoOriginal.length > 180 ? `${prefill.textoOriginal.slice(0, 180)}…` : prefill.textoOriginal}
            </p>
          )}

          <div className="campo">
            <div className="filtros-grupo" role="group" aria-label="Qué se registra">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`filtro ${modo === m.id ? 'is-activo' : ''}`}
                  onClick={() => cambiarModo(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <label className="campo">
            <span className="campo-label">{tipo === 'ingreso' ? '¿Qué entró?' : '¿Qué se pagó?'}</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={tipo === 'ingreso' ? 'Sueldo de septiembre' : 'Mercado en Mercadona'}
              maxLength={120}
              autoFocus={!prefill}
            />
          </label>

          <CampoMonto
            label={esPorPagar ? 'Monto estimado' : 'Cuánto fue'}
            opcional={esPorPagar}
            valor={monto}
            onValor={setMonto}
            moneda={moneda}
            onMoneda={setMoneda}
            autoFocus={Boolean(prefill)}
          />

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
            {esPorPagar ? (
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

          {visibles.length > 0 && (
            <label className="campo">
              <span className="campo-label">
                ¿De qué cuenta o tarjeta? <span className="campo-opcional">opcional</span>
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
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Compra de la semana."
              rows={2}
              maxLength={2000}
            />
          </label>

          <SelectorAdjuntos valor={adjuntos} onCambio={setAdjuntos} />

          {err && <p className="campo-error">⚠️ {err}</p>}

          <footer className="modal-pie">
            <button type="button" className="btn btn-ghost" onClick={onCerrar}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              disabled={ocupado || !titulo.trim() || !categoria || (!esPorPagar && !String(monto).trim())}
            >
              {ocupado ? 'Guardando…' : esPorPagar ? 'Anotar' : 'Registrar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
