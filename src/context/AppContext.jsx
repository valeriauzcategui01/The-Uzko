import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { hoyDia, mesActual, mesesConDatos } from '../lib/calculos'
import { bsAEuros, monto, usdAEuros } from '../lib/tasa'

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

// ── MODO DE PRUEBA ──────────────────────────────────────────────────────────
//
// Si el servidor contesta que no tiene dónde guardar (Redis sin conectar en
// Vercel), la app NO se queda en una pantalla de error: pasa a modo de
// prueba. Todo funciona —registrar, pagar, anular, cuentas— pero los datos
// viven en el localStorage de ESTE navegador, y un aviso permanente lo dice.
// Eduardo lo pidió el 22/09/2026 para poder probar la app completa en el
// teléfono antes de conectar la base de datos.
//
// La conversión usa las MISMAS funciones que el servidor (lib/tasa re-exporta
// api/_lib/numeros.js) y las tasas reales del BCV, que /api/tasa sí puede
// servir sin Redis: pierde el caché, no la tasa. Al conectar Redis, el modo
// desaparece solo en la siguiente carga y lo probado se queda atrás.
const CLAVE_DEMO = 'uzko.demo.v1'

function leerDemo() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE_DEMO))
    return { movimientos: d?.movimientos ?? [], cuentas: d?.cuentas ?? [], numero: d?.numero ?? 0 }
  } catch {
    return { movimientos: [], cuentas: [], numero: 0 }
  }
}

function escribirDemo(datos) {
  try {
    localStorage.setItem(CLAVE_DEMO, JSON.stringify(datos))
  } catch {
    /* storage lleno o incógnito: la prueba sigue, solo no sobrevive recargas */
  }
}

const uuid = () =>
  crypto.randomUUID?.() ?? `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function AppProvider({ children }) {
  const [movimientos, setMovimientos] = useState([])
  const [cuentas, setCuentas] = useState([])
  // Las dos monedas convertibles, `{ eur, usd }`, cada una con su estado o
  // null: el dólar puede faltar un día sin que falte el euro.
  const [tasas, setTasas] = useState({})
  const [bandejaNuevas, setBandejaNuevas] = useState(0)
  const [almacen, setAlmacen] = useState(null)
  const [demo, setDemo] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [mes, setMes] = useState(mesActual())
  // El contador del número visible (#1, #2…) en modo de prueba.
  const numeroDemo = useRef(0)

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

      // Sin almacén no hay error que enseñar: hay modo de prueba que abrir.
      if (r.status === 503 && j.almacen === 'sin-configurar') {
        const guardado = leerDemo()
        numeroDemo.current = guardado.numero
        setMovimientos(guardado.movimientos)
        setCuentas(guardado.cuentas)
        setDemo(true)
        setAlmacen('sin-configurar')
        setBandejaNuevas(0)
        // Las tasas reales sí están disponibles sin Redis.
        try {
          const rt = await fetch('/api/tasa', { credentials: 'include', signal: AbortSignal.timeout(15000) })
          const jt = await rt.json().catch(() => ({}))
          if (rt.ok) setTasas(jt.tasas ?? {})
        } catch {
          /* sin tasas solo se puede teclear en euros, y la app lo dice */
        }
        return
      }

      if (!r.ok) throw new Error(j.error || `El servidor respondió ${r.status}`)
      setDemo(false)
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

  // ── el simulador del modo de prueba ───────────────────────────────────────

  // La misma conversión que hace el servidor al crear un movimiento de
  // verdad, con las tasas del BCV que ya están en pantalla.
  const enEurosDemo = useCallback(
    (valor, moneda) => {
      const n = monto(valor)
      if (n == null) return { eur: null, original: null }
      if (moneda !== 'bs' && moneda !== 'usd') return { eur: n, original: null }
      const tEur = tasas?.eur?.bs
      if (!tEur) throw new Error('No hay tasa del día para convertir. Teclea el monto en euros.')
      if (moneda === 'bs') {
        return { eur: bsAEuros(n, tEur), original: { moneda: 'bs', valor: n, tasa: { eur: tEur, dia: tasas.eur.dia, fuente: tasas.eur.fuente, origen: tasas.eur.origen } } }
      }
      const tUsd = tasas?.usd?.bs
      if (!tUsd) throw new Error('No hay tasa del dólar hoy. Teclea el monto en euros.')
      return { eur: usdAEuros(n, tUsd, tEur), original: { moneda: 'usd', valor: n, tasa: { eur: tEur, usd: tUsd, dia: tasas.eur.dia, fuente: tasas.eur.fuente, origen: tasas.eur.origen } } }
    },
    [tasas],
  )

  const persistir = useCallback((movs, ctas) => {
    escribirDemo({ movimientos: movs, cuentas: ctas, numero: numeroDemo.current })
  }, [])

  // Reproduce en el navegador lo esencial de api/_lib/movimientos.js. Es
  // deliberadamente más laxo que el servidor: es un cajón de arena para
  // probar la interfaz, no la contabilidad de verdad.
  const accionDemo = useCallback(
    (accion, datos) => {
      const el = new Date().toISOString()
      const yo = { id: 'demo', nombre: 'Valeria' }
      let resultado

      setMovimientos((prev) => {
        let lista = [...prev]

        if (accion === 'crear') {
          const porPagar = datos.estado === 'porPagar'
          const { eur, original } = enEurosDemo(datos.monto, datos.moneda)
          if (!porPagar && eur == null) throw new Error('Falta cuánto fue')
          if (!String(datos.titulo ?? '').trim()) throw new Error('Falta el título')
          numeroDemo.current += 1
          resultado = {
            id: uuid(),
            numero: numeroDemo.current,
            tipo: datos.tipo === 'ingreso' ? 'ingreso' : 'gasto',
            titulo: String(datos.titulo).trim(),
            categoria: datos.categoria,
            cuenta: datos.cuenta || null,
            descripcion: String(datos.descripcion ?? '').trim(),
            estado: porPagar ? 'porPagar' : 'registrado',
            fecha: porPagar ? null : (datos.fecha || hoyDia()),
            paraCuando: porPagar ? datos.paraCuando || null : null,
            montoEur: eur,
            original,
            adjuntos: [],
            origen: 'manual',
            creadoPor: yo,
            creadoEl: el,
            anulacion: null,
            historial: [{ tipo: 'creado', texto: porPagar ? 'Lo anotó como pendiente (modo de prueba)' : 'Registró el movimiento (modo de prueba)', por: yo, el }],
          }
          lista = [resultado, ...lista]
        } else {
          const i = lista.findIndex((m) => m.id === datos.id)
          if (i === -1) throw new Error('Ese movimiento no existe')
          const t = { ...lista[i], historial: [...lista[i].historial] }

          if (accion === 'pagar') {
            const { eur, original } = enEurosDemo(datos.monto, datos.moneda)
            if (eur == null) throw new Error('Falta cuánto se pagó')
            t.estado = 'registrado'
            t.montoEur = eur
            t.original = original
            t.fecha = datos.fecha || hoyDia()
            t.historial.push({ tipo: 'pagado', texto: 'Lo pagó (modo de prueba)', por: yo, el })
          } else if (accion === 'deshacerPago') {
            t.estado = 'porPagar'
            t.fecha = null
            t.historial.push({ tipo: 'reabierto', texto: 'Deshizo el pago', por: yo, el })
          } else if (accion === 'anular') {
            t.estadoPrevio = t.estado
            t.estado = 'anulado'
            t.anulacion = { motivo: datos.motivo, por: yo, el }
            t.historial.push({ tipo: 'anulado', texto: datos.motivo || 'Anulado', por: yo, el })
          } else if (accion === 'reactivar') {
            t.estado = t.estadoPrevio ?? 'registrado'
            t.anulacion = null
            t.historial.push({ tipo: 'reactivado', texto: 'Lo reactivó', por: yo, el })
          } else if (accion === 'editar') {
            if (datos.titulo !== undefined) t.titulo = String(datos.titulo).trim() || t.titulo
            if (datos.categoria !== undefined) t.categoria = datos.categoria
            if (datos.cuenta !== undefined) t.cuenta = datos.cuenta || null
            if (datos.descripcion !== undefined) t.descripcion = String(datos.descripcion ?? '').trim()
            if (datos.fecha && t.estado === 'registrado') t.fecha = datos.fecha
            if (datos.paraCuando !== undefined && t.estado === 'porPagar') t.paraCuando = datos.paraCuando || null
            if (datos.monto !== undefined) {
              const { eur, original } = enEurosDemo(datos.monto, datos.moneda)
              if (eur != null || t.estado === 'porPagar') {
                t.montoEur = eur
                t.original = original
              }
            }
            t.historial.push({ tipo: 'editado', texto: 'Corrigió el movimiento (modo de prueba)', por: yo, el })
          } else if (accion === 'comentar') {
            t.historial.push({ tipo: 'comentario', texto: datos.texto || 'Comentario', por: yo, el })
          } else {
            throw new Error('Esa acción no está en el modo de prueba')
          }
          lista[i] = t
          resultado = t
        }

        persistir(lista, cuentas)
        return lista
      })

      return resultado
    },
    [cuentas, enEurosDemo, persistir],
  )

  const cuentaDemo = useCallback(
    (accion, datos) => {
      let resultado
      setCuentas((prev) => {
        let lista = [...prev]
        if (accion === 'crear') {
          if (!String(datos.nombre ?? '').trim()) throw new Error('La cuenta necesita un nombre')
          resultado = {
            id: uuid(),
            nombre: String(datos.nombre).trim(),
            tipo: datos.tipo ?? 'otra',
            moneda: datos.moneda ?? 'eur',
            color: datos.color ?? '#6366f1',
            archivada: false,
            creadaEl: new Date().toISOString(),
          }
          lista = [...lista, resultado]
        } else {
          const i = lista.findIndex((c) => c.id === datos.id)
          if (i === -1) throw new Error('Esa cuenta no existe')
          if (accion === 'editar') lista[i] = { ...lista[i], nombre: datos.nombre ?? lista[i].nombre, tipo: datos.tipo ?? lista[i].tipo, moneda: datos.moneda ?? lista[i].moneda, color: datos.color ?? lista[i].color }
          if (accion === 'archivar') lista[i] = { ...lista[i], archivada: true }
          if (accion === 'restaurar') lista[i] = { ...lista[i], archivada: false }
          resultado = lista[i]
        }
        persistir(movimientos, lista)
        return lista
      })
      return resultado
    },
    [movimientos, persistir],
  )

  // ── acciones (el camino real, o el simulador) ─────────────────────────────

  const accion = useCallback(
    async (nombre, datos = {}) => {
      if (demo) return accionDemo(nombre, datos)
      const r = await fetch('/api/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accion: nombre, ...datos }),
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
    },
    [demo, accionDemo],
  )

  // Las cuentas: el servidor devuelve la lista entera tras cada cambio.
  const accionCuenta = useCallback(
    async (nombre, datos = {}) => {
      if (demo) return cuentaDemo(nombre, datos)
      const r = await fetch('/api/cuentas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accion: nombre, ...datos }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'No se pudo guardar la cuenta')
      setCuentas(j.cuentas ?? [])
      return j.cuenta
    },
    [demo, cuentaDemo],
  )

  // Corregir la tasa a mano, y deshacer la corrección. En modo de prueba la
  // corrección vive solo en esta pestaña: el servidor no tiene dónde
  // guardarla todavía.
  const cambiarTasa = useCallback(
    async (cuerpo) => {
      if (demo) {
        const moneda = cuerpo.moneda === 'usd' ? 'usd' : 'eur'
        if (cuerpo.accion === 'auto') {
          const r = await fetch('/api/tasa', { credentials: 'include' })
          const j = await r.json().catch(() => ({}))
          if (r.ok) setTasas(j.tasas ?? {})
          return
        }
        const bs = monto(cuerpo.bs)
        if (!bs) throw new Error('Esa tasa no se entiende')
        setTasas((prev) => ({
          ...prev,
          [moneda]: { moneda, bs, dia: hoyDia(), fuente: 'a mano (prueba)', origen: 'manual', vieja: false, actualizadaEl: new Date().toISOString(), por: { nombre: 'Valeria' } },
        }))
        return
      }
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
    },
    [demo],
  )

  const meses = useMemo(() => mesesConDatos(movimientos), [movimientos])

  const valor = useMemo(
    () => ({
      movimientos,
      cuentas,
      tasas,
      almacen,
      demo,
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
    [movimientos, cuentas, tasas, almacen, demo, cargando, error, cargar, mes, meses, bandejaNuevas, accion, accionCuenta, cambiarTasa],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp se usó fuera de <AppProvider>')
  return v
}
