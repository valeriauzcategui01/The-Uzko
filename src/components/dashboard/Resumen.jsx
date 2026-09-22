import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useApp } from '../../context/AppContext'
import { useSesion } from '../../auth/Sesion'
import { usePresupuesto } from '../../lib/usePresupuesto'
import { Barra, Card, Cargando, Delta, ErrorAviso, Kpi, Vacio } from '../common/Ui'
import Icono from '../common/Iconos'
import { dinero, dineroCorto, variacion } from '../../lib/format'
import {
  etiquetaMes,
  gastosDelMes,
  ingresosDelMes,
  nombreMes,
  porCategoria,
  presupuestoVsGasto,
  sumar,
  tendencia,
  totalPresupuesto,
} from '../../lib/calculos'
import { MovFila } from '../movimientos/piezas'
import MovimientoDetalle from '../movimientos/MovimientoDetalle'
import NuevoMovimiento from '../movimientos/NuevoMovimiento'

// EL RESUMEN: la primera pantalla, y la respuesta a "¿cómo voy este mes?".
//
// Cuánto se gastó, cuánto queda del presupuesto, en qué se fue, y cómo viene
// el ritmo contra los meses anteriores. Todo derivado de los movimientos al
// momento de mirar: aquí no hay ningún número guardado.
export default function Resumen({ onNavegar }) {
  const { movimientos, cuentas, cargando, error, recargar, mes } = useApp()
  const { puedeEscribir } = useSesion()
  const { presupuesto } = usePresupuesto(mes)
  const [abierto, setAbierto] = useState(null)
  const [creando, setCreando] = useState(false)

  const porCuenta = useMemo(() => new Map(cuentas.map((c) => [c.id, c])), [cuentas])

  const datos = useMemo(() => {
    const gastos = gastosDelMes(movimientos, mes)
    const ingresos = ingresosDelMes(movimientos, mes)
    const serie = tendencia(movimientos, mes, 6)
    const mesAnterior = serie.length >= 2 ? serie[serie.length - 2] : null
    const porPagar = movimientos.filter((m) => m.estado === 'porPagar')
    return {
      gastos,
      gastado: sumar(gastos),
      ingresado: sumar(ingresos),
      categorias: porCategoria(gastos),
      serie,
      deltaGasto: mesAnterior ? variacion(sumar(gastos), mesAnterior.gasto) : null,
      porPagar,
      recientes: [...gastos, ...ingresos]
        .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '') || b.creadoEl.localeCompare(a.creadoEl))
        .slice(0, 6),
    }
  }, [movimientos, mes])

  const plan = useMemo(() => {
    if (!presupuesto?.porCategoria || !Object.keys(presupuesto.porCategoria).length) return null
    const total = totalPresupuesto(presupuesto.porCategoria)
    const filas = presupuestoVsGasto(presupuesto.porCategoria, datos.gastos)
    return {
      total,
      restante: total - datos.gastado,
      filas: filas.filter((f) => f.presupuestado > 0).slice(0, 5),
      pasados: filas.filter((f) => f.presupuestado > 0 && f.gastado > f.presupuestado),
    }
  }, [presupuesto, datos])

  if (cargando) return <Cargando>Cargando tus finanzas…</Cargando>
  if (error) return <ErrorAviso mensaje={error} onReintentar={recargar} />

  const movAbierto = abierto ? movimientos.find((m) => m.id === abierto) : null
  const nombreDelMes = etiquetaMes(mes, false).toLowerCase()

  return (
    <div className="vista">
      <div className="kpi-row">
        <Kpi
          label={`Gastado en ${nombreDelMes}`}
          value={dinero(datos.gastado)}
          icono={<Icono name="cartera" size={16} />}
          color="#a97002"
          pie={<Delta v={datos.deltaGasto} />}
        />
        <Kpi
          label="Presupuesto restante"
          value={plan ? dinero(plan.restante) : '—'}
          tono={plan && plan.restante < 0 ? 'mal' : undefined}
          icono={<Icono name="calendario" size={16} />}
          color="#0891b2"
          pie={
            <span className="kpi-pie-extra">
              {plan
                ? plan.restante < 0
                  ? `te pasaste ${dinero(-plan.restante)} de ${dinero(plan.total)}`
                  : `de ${dinero(plan.total)} presupuestados`
                : 'este mes no tiene presupuesto todavía'}
            </span>
          }
        />
        <Kpi
          label="Ingresos del mes"
          value={dinero(datos.ingresado)}
          icono={<Icono name="grafica" size={16} />}
          color="#16a34a"
          pie={
            <span className="kpi-pie-extra">
              {datos.ingresado > 0
                ? `balance: ${dinero(datos.ingresado - datos.gastado)}`
                : 'sin ingresos registrados'}
            </span>
          }
        />
        <Kpi
          label="Por pagar"
          value={String(datos.porPagar.length)}
          tono={datos.porPagar.length > 0 ? 'ojo' : undefined}
          icono={<Icono name="reloj" size={16} />}
          color="#f59e0b"
          pie={<span className="kpi-pie-extra">{datos.porPagar.length ? 'cuentas esperando' : 'nada pendiente'}</span>}
        />
      </div>

      {/* Aviso de categorías pasadas de presupuesto: es LA alerta que un
          presupuesto existe para dar, así que va arriba y en ámbar. */}
      {plan && plan.pasados.length > 0 && (
        <button className="aviso" onClick={() => onNavegar?.('presupuesto')}>
          <span className="aviso-icono" aria-hidden>⚠️</span>
          <span>
            {plan.pasados.length === 1
              ? `${plan.pasados[0].label} ya se pasó de su presupuesto (${dinero(plan.pasados[0].gastado)} de ${dinero(plan.pasados[0].presupuestado)}).`
              : `${plan.pasados.length} categorías ya se pasaron de su presupuesto este mes.`}
          </span>
          <span className="aviso-cta">Ver presupuesto</span>
        </button>
      )}

      <div className="grid-2">
        <Card title="¿En qué se fue?" subtitle={`Gasto por categoría · ${etiquetaMes(mes)}`}>
          {datos.categorias.length === 0 ? (
            <Vacio>
              Todavía no hay gastos en {nombreDelMes}.{' '}
              {puedeEscribir && 'Registra el primero con el botón de abajo.'}
            </Vacio>
          ) : (
            <div className="dona-layout">
              <div className="dona-grafica">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={datos.categorias}
                      dataKey="total"
                      nameKey="label"
                      innerRadius={62}
                      outerRadius={95}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {datos.categorias.map((c) => (
                        <Cell key={c.id} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => dinero(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dona-centro">
                  <strong>{dinero(datos.gastado)}</strong>
                  <span>{nombreMes(mes)}</span>
                </div>
              </div>
              <ul className="dona-leyenda">
                {datos.categorias.slice(0, 7).map((c) => (
                  <li key={c.id}>
                    <i style={{ background: c.color }} />
                    <span className="leyenda-nombre">{c.label}</span>
                    <Barra fraccion={c.total / datos.gastado} color={c.color} />
                    <span className="leyenda-monto">{dinero(c.total)}</span>
                  </li>
                ))}
                {datos.categorias.length > 7 && (
                  <li className="leyenda-mas">y {datos.categorias.length - 7} categorías más…</li>
                )}
              </ul>
            </div>
          )}
        </Card>

        <Card title="El ritmo" subtitle="Gasto de los últimos 6 meses, en euros">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={datos.serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={dineroCorto} tickLine={false} axisLine={false} fontSize={11} width={52} />
              <Tooltip formatter={(v) => dinero(v)} labelFormatter={(l) => l} cursor={{ fill: 'rgba(255, 194, 14, 0.12)' }} />
              <Bar dataKey="gasto" name="Gasto" radius={[6, 6, 0, 0]}>
                {datos.serie.map((f) => (
                  <Cell key={f.mes} fill={f.mes === mes ? '#ffc20e' : '#e8dfc6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {plan && (
        <Card
          title="El presupuesto, de un vistazo"
          subtitle={`Las categorías con más plan · ${etiquetaMes(mes)}`}
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => onNavegar?.('presupuesto')}>
              Ver completo
            </button>
          }
        >
          <div className="plan-filas">
            {plan.filas.map((f) => {
              const fraccion = f.presupuestado > 0 ? f.gastado / f.presupuestado : 0
              return (
                <div className="plan-fila" key={f.id}>
                  <span className="plan-nombre">{f.label}</span>
                  <Barra fraccion={Math.min(1, fraccion)} color={fraccion > 1 ? '#ef4444' : f.color} />
                  <span className={`plan-cifra ${fraccion > 1 ? 'is-pasado' : ''}`}>
                    {dinero(f.gastado)} <span className="plan-de">de {dinero(f.presupuestado)}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card
        title="Lo último"
        subtitle="Los movimientos más recientes del mes"
        action={
          puedeEscribir && (
            <button className="btn btn-primary" onClick={() => setCreando(true)}>
              <Icono name="mas" size={16} /> Registrar
            </button>
          )
        }
      >
        {datos.recientes.length === 0 ? (
          <Vacio>Cuando registres el primer gasto del mes, aparece aquí.</Vacio>
        ) : (
          <div className="ticket-lista">
            {datos.recientes.map((m) => (
              <MovFila key={m.id} mov={m} cuenta={porCuenta.get(m.cuenta)} onAbrir={() => setAbierto(m.id)} />
            ))}
          </div>
        )}
      </Card>

      {creando && <NuevoMovimiento onCerrar={() => setCreando(false)} onCreado={(m) => setAbierto(m.id)} />}

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
