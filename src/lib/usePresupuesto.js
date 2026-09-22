import { useCallback, useEffect, useState } from 'react'

// El presupuesto de UN mes, pedido cuando se necesita.
//
// No viaja con /api/movimientos a propósito: cambia de mes en mes y solo lo
// miran dos vistas (el resumen y el editor). Cada una lo pide con este hook y
// las dos ven lo mismo porque el servidor es la única fuente.
export function usePresupuesto(mes) {
  const [presupuesto, setPresupuesto] = useState(null)
  const [anterior, setAnterior] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    if (!mes) return
    setCargando(true)
    setError(null)
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
  }, [mes])

  useEffect(() => {
    cargar()
  }, [cargar])

  const guardar = useCallback(
    async (porCategoria) => {
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
    [mes],
  )

  return { presupuesto, anterior, cargando, error, recargar: cargar, guardar }
}
