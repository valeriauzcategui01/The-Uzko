import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { mesActual, mesesConDatos } from '../lib/calculos'

const Ctx = createContext(null)

// UN SOLO contexto para toda la app: los movimientos, las cuentas, las tasas
// del día y el contador de la bandeja llegan juntos en una petición a
// /api/movimientos, y el mes seleccionado en el header vive aquí porque lo
// comparten el resumen, la lista y el presupuesto.
//
// Los movimientos se cargan de una y se filtran en el navegador: son cientos
// al año, no miles. Después de cada acción el servidor devuelve el movimiento
// ya actualizado y se reemplaza en la lista, en vez de volver a pedirlo todo:
// el cambio se ve al instante aunque la conexión esté lenta.
export function AppProvider({ children }) {
  const [movimientos, setMovimientos] = useState([])
  const [cuentas, setCuentas] = useState([])
  // Las dos monedas convertibles, `{ eur, usd }`, cada una con su estado o
  // null: el dólar puede faltar un día sin que falte el euro.
  const [tasas, setTasas] = useState({})
  const [bandejaNuevas, setBandejaNuevas] = useState(0)
  const [almacen, setAlmacen] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mes, setMes] = useState(mesActual())

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      // CON PLAZO: una petición colgada no se ve como un fallo, se ve como
      // que el mes no existe. Veinte segundos alcanzan incluso arrancando la
      // función en frío; pasados, mejor decir que falló con su botón de
      // reintentar que seguir girando en silencio.
      const r = await fetch('/api/movimientos', {
        credentials: 'include',
        signal: AbortSignal.timeout(20000),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `El servidor respondió ${r.status}`)
      setMovimientos(j.movimientos ?? [])
      setCuentas(j.cuentas ?? [])
      setTasas(j.tasas ?? {})
      setBandejaNuevas(j.bandejaNuevas ?? 0)
      setAlmacen(j.almacen ?? null)
    } catch (e) {
      setError(
        e.name === 'TimeoutError'
          ? 'El servidor tardó demasiado en responder.'
          : e.message || 'No se pudieron cargar los movimientos',
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Toda acción sobre movimientos pasa por aquí: mismo manejo de errores y
  // misma actualización de la lista.
  const accion = useCallback(async (accion, datos = {}) => {
    const r = await fetch('/api/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accion, ...datos }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'No se pudo completar la acción')

    setMovimientos((prev) => {
      const i = prev.findIndex((t) => t.id === j.movimiento.id)
      if (i === -1) return [j.movimiento, ...prev]
      const copia = [...prev]
      copia[i] = j.movimiento
      return copia
    })
    return j.movimiento
  }, [])

  // Las cuentas: el servidor devuelve la lista entera tras cada cambio.
  const accionCuenta = useCallback(async (accion, datos = {}) => {
    const r = await fetch('/api/cuentas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accion, ...datos }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'No se pudo guardar la cuenta')
    setCuentas(j.cuentas ?? [])
    return j.cuenta
  }, [])

  // Corregir la tasa a mano, y deshacer la corrección.
  const cambiarTasa = useCallback(async (cuerpo) => {
    const r = await fetch('/api/tasa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(cuerpo),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'No se pudo cambiar la tasa')
    setTasas(j.tasas ?? {})
    return j.tasas
  }, [])

  const meses = useMemo(() => mesesConDatos(movimientos), [movimientos])

  const valor = useMemo(
    () => ({
      movimientos,
      cuentas,
      tasas,
      almacen,
      cargando,
      error,
      recargar: cargar,
      mes,
      setMes,
      meses,
      bandejaNuevas,
      setBandejaNuevas,
      crear: (d) => accion('crear', d),
      pagar: (id, d) => accion('pagar', { id, ...d }),
      deshacerPago: (id) => accion('deshacerPago', { id }),
      editar: (id, d) => accion('editar', { id, ...d }),
      anular: (id, d) => accion('anular', { id, ...d }),
      reactivar: (id) => accion('reactivar', { id }),
      comentar: (id, d) => accion('comentar', { id, ...d }),
      crearCuenta: (d) => accionCuenta('crear', d),
      editarCuenta: (id, d) => accionCuenta('editar', { id, ...d }),
      archivarCuenta: (id) => accionCuenta('archivar', { id }),
      restaurarCuenta: (id) => accionCuenta('restaurar', { id }),
      fijarTasa: (moneda, bs) => cambiarTasa({ moneda, bs }),
      tasaAutomatica: (moneda) => cambiarTasa({ accion: 'auto', moneda }),
    }),
    [movimientos, cuentas, tasas, almacen, cargando, error, cargar, mes, meses, bandejaNuevas, accion, accionCuenta, cambiarTasa],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp se usó fuera de <AppProvider>')
  return v
}
