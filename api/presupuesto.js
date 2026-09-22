import { requireUser } from './_lib/auth.js'
import { leerBody } from './_lib/body.js'
import { ErrorPresupuesto, guardarPresupuesto, leerPresupuesto, mesValido } from './_lib/presupuesto.js'

// El presupuesto por mes.
//
//   GET  /api/presupuesto?mes=2026-09  -> el del mes, y el del mes anterior
//                                         (para el botón de "copiar")
//   POST /api/presupuesto {mes, porCategoria: {mercado: '250', ...}}

function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 2, 15)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function handler(req, res) {
  const auth = requireUser(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }
  res.setHeader('Cache-Control', 'private, no-store')

  try {
    if (req.method === 'GET') {
      const mes = String(req.url.match(/[?&]mes=([^&]+)/)?.[1] ?? '')
      if (!mesValido(mes)) {
        res.status(400).json({ error: 'Falta el mes (formato 2026-09)' })
        return
      }
      const [presupuesto, anterior] = await Promise.all([
        leerPresupuesto(mes),
        leerPresupuesto(mesAnterior(mes)),
      ])
      res.status(200).json({ mes, presupuesto, anterior })
      return
    }

    if (req.method === 'POST') {
      const body = await leerBody(req)
      const presupuesto = await guardarPresupuesto(auth.usuario, String(body?.mes ?? ''), body?.porCategoria)
      res.status(200).json({ ok: true, presupuesto })
      return
    }

    res.status(405).json({ error: 'Método no permitido' })
  } catch (e) {
    if (e instanceof ErrorPresupuesto) {
      res.status(e.status).json({ error: e.message })
      return
    }
    console.error('[presupuesto]', e)
    res.status(500).json({ error: 'No se pudo guardar el presupuesto. Intenta de nuevo.' })
  }
}
