import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { monto } from './tasa'

// El presupuesto de UN mes, pedido cuando se necesita.
//
// No viaja con /api/movimientos a propósito: cambia de mes en mes y solo lo
// miran dos vistas (el resumen y el editor). Cada una lo pide con este hook y
// las dos ven lo mismo porque el servidor es la única fuente.
//
// En MODO DE PRUEBA (sin Redis conectado) el presupuesto vive en el
// localStorage, como los movimientos: se puede probar el editor completo y
// nada viaja al servidor.
const CLAVE_DEMO = 'uzko.demo.presupuestos.v1'

function leerDemo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_DEMO)) ?? {}
  } catch {
    return {}
  }
}

function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 2, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function usePresupuesto(mes) {
  const { demo } = useApp()
  const [presupuesto, setPresupuesto] = useState(null)
  const [anterior, setAnterior] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    if (!mes) return
    setCargando(true)
    setError(null)
    if (demo) {
      const todos = leerDemo()
      setPresupuesto(todos[mes] ?? null)
      setAnterior(todos[mesAnterior(mes)] ?? null)
      setCargando(false)
      return
    }
    try {
      const r = await fetch(`/api/presupuesto?mes=${mes}`, { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `El servidor respondió ${r.status}`)
      setPresupuesto(j.presupuesto ?? null)
      setAnterior(j.anterior ?? null)
    } catch (e) {
      setError(e.message || 'No se pudo cargar el presupuesto')
    } finally {
      setCargando(false)
    }
  }, [mes, demo])

  useEffect(() => {
    cargar()
  }, [cargar])

  const guardar = useCallback(
    async (porCategoria) => {
      if (demo) {
        // La misma limpieza que hace el servidor: solo cifras que se
        // entienden y mayores que cero.
        const limpio = {}
        for (const [id, v] of Object.entries(porCategoria ?? {})) {
          const n = monto(v)
          if (n != null && n > 0) limpio[id] = n
        }
        const nuevo = { mes, porCategoria: limpio, actualizadoEl: new Date().toISOString() }
        const todos = leerDemo()
        todos[mes] = nuevo
        try {
          localStorage.setItem(CLAVE_DEMO, JSON.stringify(todos))
        } catch {
          /* incógnito: no sobrevive recargas, la prueba sigue */
        }
        setPresupuesto(nuevo)
        return nuevo
      }
      const r = await fetch('/api/presupuesto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mes, porCategoria }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'No se pudo guardar el presupuesto')
      setPresupuesto(j.presupuesto)
      return j.presupuesto
    },
    [mes, demo],
  )

  return { presupuesto, anterior, cargando, error, recargar: cargar, guardar }
}
