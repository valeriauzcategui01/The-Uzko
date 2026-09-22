import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useSesion } from '../../auth/Sesion'
import { Card, Cargando, ErrorAviso, Vacio } from '../common/Ui'
import Icono from '../common/Iconos'
import { TIPOS_CUENTA, MONEDAS_APP } from '../../config'
import { dinero } from '../../lib/format'
import { mesDe, sumar } from '../../lib/calculos'

// LAS CUENTAS Y TARJETAS.
//
// De dónde sale el dinero: la Visa, la cuenta del banco, el efectivo. Cada
// movimiento puede decir de cuál salió, y esta vista enseña cuánto se ha
// movido por cada una este mes. No se llevan saldos: eso lo sabe el banco;
// aquí se lleva EL GASTO, que es lo que el banco no cuenta bien.
//
// Una cuenta no se borra: se archiva. Los movimientos viejos la nombran, y
// borrarla dejaría "¿de qué tarjeta salió esto?" sin respuesta.

const COLORES = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#e11d48', '#0891b2', '#1c1a14']

const ETIQUETA_TIPO = Object.fromEntries(TIPOS_CUENTA.map((t) => [t.id, t.label]))
const SIMBOLO = Object.fromEntries(MONEDAS_APP.map((m) => [m.id, m.simbolo]))

export default function Cuentas() {
  const { movimientos, cuentas, cargando, error, recargar, mes, crearCuenta, editarCuenta, archivarCuenta, restaurarCuenta } = useApp()
  const { puedeEscribir } = useSesion()
  const [editando, setEditando] = useState(null) // 'nueva' | cuenta
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)

  // Cuánto se movió por cada cuenta este mes, derivado al mirar.
  const usoDelMes = useMemo(() => {
    const uso = new Map()
    for (const m of movimientos) {
      if (m.estado !== 'registrado' || m.tipo !== 'gasto' || !m.cuenta || mesDe(m) !== mes) continue
      uso.set(m.cuenta, [...(uso.get(m.cuenta) ?? []), m])
    }
    return uso
  }, [movimientos, mes])

  const correr = async (fn) => {
    setOcupado(true)
    setErr('')
    try {
      await fn()
      setEditando(null)
    } catch (e) {
      setErr(e.message || 'No se pudo guardar')
    } finally {
      setOcupado(false)
    }
  }

  if (cargando) return <Cargando>Cargando las cuentas…</Cargando>
  if (error) return <ErrorAviso mensaje={error} onReintentar={recargar} />

  const activas = cuentas.filter((c) => !c.archivada)
  const archivadas = cuentas.filter((c) => c.archivada)

  return (
    <div className="vista">
      <Card
        title="Cuentas y tarjetas"
        subtitle="De dónde sale el dinero, y cuánto se movió por cada una este mes"
        action={
          puedeEscribir && (
            <button className="btn btn-primary" onClick={() => { setEditando('nueva'); setErr('') }}>
              <Icono name="mas" size={16} /> Nueva cuenta
            </button>
          )
        }
      >
        {activas.length === 0 && editando !== 'nueva' ? (
          <Vacio>
            Todavía no hay cuentas. Crea la primera —"Visa BBVA", "Efectivo", "Zelle"— y cada gasto
            podrá decir de dónde salió.
          </Vacio>
        ) : (
          <div className="cuentas-lista">
            {activas.map((c) => {
              const movs = usoDelMes.get(c.id) ?? []
              return (
                <div className="cuenta-card" key={c.id} style={{ borderTopColor: c.color }}>
                  <div className="cuenta-head">
                    <span className="cuenta-punto" style={{ background: c.color }}>{SIMBOLO[c.moneda] ?? '€'}</span>
                    <div className="cuenta-nombres">
                      <strong>{c.nombre}</strong>
                      <span className="dato-pie">{ETIQUETA_TIPO[c.tipo] ?? c.tipo}</span>
                    </div>
                    {puedeEscribir && (
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditando(c); setErr('') }}>
                        <Icono name="lapiz" size={14} />
                      </button>
                    )}
                  </div>
                  <div className="cuenta-uso">
                    <span className="cuenta-uso-monto">{dinero(sumar(movs))}</span>
                    <span className="dato-pie">
                      {movs.length ? `${movs.length} gasto${movs.length > 1 ? 's' : ''} este mes` : 'sin movimientos este mes'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {archivadas.length > 0 && (
          <div className="cuentas-archivadas">
            <span className="dato-label">Archivadas</span>
            {archivadas.map((c) => (
              <span key={c.id} className="cuenta-archivada">
                {c.nombre}
                {puedeEscribir && (
                  <button className="btn btn-ghost btn-sm" disabled={ocupado} onClick={() => correr(() => restaurarCuenta(c.id))}>
                    Restaurar
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </Card>

      {editando && (
        <FormularioCuenta
          cuenta={editando === 'nueva' ? null : editando}
          ocupado={ocupado}
          err={err}
          onCerrar={() => setEditando(null)}
          onEnviar={(d) =>
            correr(() => (editando === 'nueva' ? crearCuenta(d) : editarCuenta(editando.id, d)))
          }
          onArchivar={editando !== 'nueva' ? () => correr(() => archivarCuenta(editando.id)) : null}
        />
      )}
    </div>
  )
}

function FormularioCuenta({ cuenta, onEnviar, onCerrar, onArchivar, ocupado, err }) {
  const [nombre, setNombre] = useState(cuenta?.nombre ?? '')
  const [tipo, setTipo] = useState(cuenta?.tipo ?? 'debito')
  const [moneda, setMoneda] = useState(cuenta?.moneda ?? 'eur')
  const [color, setColor] = useState(cuenta?.color ?? COLORES[0])

  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{cuenta ? 'Editar la cuenta' : 'Nueva cuenta o tarjeta'}</h2>
          <button className="modal-cerrar" onClick={onCerrar} title="Cerrar">×</button>
        </header>

        <form
          className="modal-cuerpo"
          onSubmit={(e) => {
            e.preventDefault()
            onEnviar({ nombre, tipo, moneda, color })
          }}
        >
          <label className="campo">
            <span className="campo-label">¿Cómo se llama?</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Visa BBVA · Efectivo · Zelle"
              maxLength={60}
              autoFocus
            />
          </label>

          <div className="campo-fila">
            <label className="campo">
              <span className="campo-label">Tipo</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS_CUENTA.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span className="campo-label">Moneda habitual</span>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                {MONEDAS_APP.map((m) => (
                  <option key={m.id} value={m.id}>{m.simbolo} {m.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="campo">
            <span className="campo-label">Color</span>
            <div className="chips-casa">
              {COLORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-chip ${color === c ? 'is-activo' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </label>

          {err && <p className="campo-error">⚠️ {err}</p>}

          <footer className="modal-pie">
            {onArchivar && (
              <button type="button" className="btn btn-ghost" disabled={ocupado} onClick={onArchivar} style={{ marginRight: 'auto' }}>
                Archivar
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onCerrar}>
              Cancelar
            </button>
            <button className="btn btn-primary" disabled={ocupado || !nombre.trim()}>
              {ocupado ? 'Guardando…' : 'Guardar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
