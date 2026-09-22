import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useSesion } from '../../auth/Sesion'
import { usePresupuesto } from '../../lib/usePresupuesto'
import { Barra, Card, Cargando, ErrorAviso, Kpi, Vacio } from '../common/Ui'
import Icono from '../common/Iconos'
import { CATEGORIAS_GASTO } from '../../config'
import { dinero, paraTeclear, porcentaje } from '../../lib/format'
import { monto } from '../../lib/tasa'
import { etiquetaMes, gastosDelMes, porCategoria, sumar } from '../../lib/calculos'

// EL PRESUPUESTO DEL MES.
//
// Una fila por categoría: cuánto se quiere gastar, cuánto va, y la barra que
// lo dice de un vistazo. Se edita aquí mismo —tocar "Editar", escribir las
// cifras en euros, guardar— y el resumen lo recoge al momento.
//
// El botón "Copiar del mes anterior" existe porque un presupuesto casi nunca
// se inventa de cero: se ajusta el del mes pasado.
export default function Presupuesto() {
  const { movimientos, mes } = useApp()
  const { puedeEscribir } = useSesion()
  const { presupuesto, anterior, cargando, error, recargar, guardar } = usePresupuesto(mes)
  const [editando, setEditando] = useState(false)
  const [borrador, setBorrador] = useState({})
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const gastos = useMemo(() => gastosDelMes(movimientos, mes), [movimientos, mes])
  const gastado = useMemo(() => new Map(porCategoria(gastos).map((f) => [f.id, f.total])), [gastos])

  const plan = presupuesto?.porCategoria ?? {}
  const hayPlan = Object.keys(plan).length > 0
  const totalPlan = Object.values(plan).reduce((a, v) => a + v, 0)
  const totalGastado = sumar(gastos)

  // Al cambiar de mes o llegar el presupuesto, el modo edición se cierra: el
  // borrador era del mes anterior y guardarlo aquí escribiría el mes equivocado.
  useEffect(() => {
    setEditando(false)
    setErr('')
  }, [mes, presupuesto])

  const abrirEdicion = (base) => {
    const origen = base ?? plan
    const inicial = {}
    for (const c of CATEGORIAS_GASTO) {
      if (origen[c.id] != null) inicial[c.id] = paraTeclear(origen[c.id])
    }
    setBorrador(inicial)
    setErr('')
    setEditando(true)
  }

  const guardarBorrador = async () => {
    setOcupado(true)
    setErr('')
    try {
      await guardar(borrador)
      setEditando(false)
    } catch (e) {
      setErr(e.message || 'No se pudo guardar')
    } finally {
      setOcupado(false)
    }
  }

  const totalBorrador = Object.values(borrador).reduce((a, v) => a + (monto(v) ?? 0), 0)

  if (cargando) return <Cargando>Cargando el presupuesto…</Cargando>
  if (error) return <ErrorAviso mensaje={error} onReintentar={recargar} />

  return (
    <div className="vista">
      <div className="kpi-row">
        <Kpi
          label="Presupuesto del mes"
          value={hayPlan ? dinero(totalPlan) : '—'}
          icono={<Icono name="calendario" size={16} />}
          color="#0891b2"
          pie={<span className="kpi-pie-extra">{hayPlan ? `${Object.keys(plan).length} categorías con plan` : 'todavía sin definir'}</span>}
        />
        <Kpi
          label="Gastado"
          value={dinero(totalGastado)}
          icono={<Icono name="cartera" size={16} />}
          color="#a97002"
          pie={
            <span className="kpi-pie-extra">
              {hayPlan ? `${porcentaje(totalPlan ? totalGastado / totalPlan : 0)} del plan` : 'sin plan que comparar'}
            </span>
          }
        />
        <Kpi
          label="Restante"
          value={hayPlan ? dinero(totalPlan - totalGastado) : '—'}
          tono={hayPlan && totalPlan - totalGastado < 0 ? 'mal' : undefined}
          icono={<Icono name="check" size={16} />}
          color="#16a34a"
          pie={<span className="kpi-pie-extra">{hayPlan && totalPlan - totalGastado < 0 ? 'el mes ya se pasó del plan' : 'lo que queda para el mes'}</span>}
        />
      </div>

      <Card
        title={`Presupuesto de ${etiquetaMes(mes).toLowerCase()}`}
        subtitle="Cuánto quieres gastar en cada cosa, contra lo que llevas"
        action={
          puedeEscribir && !editando && (
            <div style={{ display: 'flex', gap: 8 }}>
              {!hayPlan && anterior?.porCategoria && Object.keys(anterior.porCategoria).length > 0 && (
                <button className="btn btn-ghost" onClick={() => abrirEdicion(anterior.porCategoria)}>
                  Copiar del mes anterior
                </button>
              )}
              <button className="btn btn-primary" onClick={() => abrirEdicion()}>
                <Icono name="lapiz" size={16} /> {hayPlan ? 'Editar' : 'Crear presupuesto'}
              </button>
            </div>
          )
        }
      >
        {!editando && !hayPlan && (
          <Vacio>
            Este mes no tiene presupuesto todavía. Se crea una vez, en euros, y cada gasto que
            registres va descontando solo.
          </Vacio>
        )}

        {!editando && hayPlan && (
          <div className="plan-filas plan-completo">
            {CATEGORIAS_GASTO.filter((c) => plan[c.id] != null || gastado.get(c.id)).map((c) => {
              const p = plan[c.id] ?? 0
              const g = gastado.get(c.id) ?? 0
              const fraccion = p > 0 ? g / p : 0
              return (
                <div className="plan-fila" key={c.id}>
                  <span className="plan-nombre">{c.label}</span>
                  <Barra fraccion={p > 0 ? Math.min(1, fraccion) : g > 0 ? 1 : 0} color={p > 0 && fraccion > 1 ? '#ef4444' : c.color} />
                  <span className={`plan-cifra ${p > 0 && fraccion > 1 ? 'is-pasado' : ''}`}>
                    {dinero(g)}{' '}
                    <span className="plan-de">{p > 0 ? `de ${dinero(p)}` : 'sin plan'}</span>
                  </span>
                </div>
              )
            })}
            <div className="plan-fila plan-total">
              <span className="plan-nombre">Total</span>
              <Barra fraccion={totalPlan > 0 ? Math.min(1, totalGastado / totalPlan) : 0} color={totalGastado > totalPlan ? '#ef4444' : '#1c1a14'} />
              <span className={`plan-cifra ${totalGastado > totalPlan ? 'is-pasado' : ''}`}>
                {dinero(totalGastado)} <span className="plan-de">de {dinero(totalPlan)}</span>
              </span>
            </div>
          </div>
        )}

        {editando && (
          <form
            className="plan-editor"
            onSubmit={(e) => {
              e.preventDefault()
              guardarBorrador()
            }}
          >
            <p className="panel-aviso">
              Escribe cuánto quieres gastar en cada categoría este mes, en euros. Las que dejes
              vacías quedan sin plan: se ven igual, solo que sin techo.
            </p>
            <div className="plan-inputs">
              {CATEGORIAS_GASTO.map((c) => (
                <label className="plan-input" key={c.id}>
                  <span className="plan-input-nombre">
                    <i style={{ background: c.color }} />
                    {c.label}
                  </span>
                  <input
                    value={borrador[c.id] ?? ''}
                    onChange={(e) => setBorrador((b) => ({ ...b, [c.id]: e.target.value }))}
                    inputMode="decimal"
                    placeholder="—"
                  />
                </label>
              ))}
            </div>
            <div className="plan-editor-total">
              Total del plan: <strong>{dinero(totalBorrador)}</strong>
            </div>
            {err && <p className="campo-error">⚠️ {err}</p>}
            <div className="panel-pie">
              <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" disabled={ocupado}>
                {ocupado ? 'Guardando…' : 'Guardar presupuesto'}
              </button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
