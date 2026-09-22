import { requireUser } from './_lib/auth.js'
import { leerBody } from './_lib/body.js'
import { ErrorBandeja, listarBandeja, marcarEntrada, recibir } from './_lib/bandeja.js'

// La bandeja de entrada, del lado de quien ya entró a la app.
//
//   GET  /api/bandeja                             -> las últimas entradas
//   POST /api/bandeja {accion:'compartir', texto} -> lo que llegó por el
//        "Compartir a Uzko" del teléfono: mismo camino que el webhook, pero
//        con la sesión de la persona en vez del token
//   POST /api/bandeja {accion:'marcar', id, estado, movimientoId}
//
// El webhook para el automatizador del teléfono es /api/inbox: aquel entra
// con token porque el teléfono no tiene sesión.

export default async function handler(req, res) {
  const auth = requireUser(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }
  res.setHeader('Cache-Control', 'private, no-store')

  try {
    if (req.method === 'GET') {
      res.status(200).json({ entradas: await listarBandeja() })
      return
    }

    if (req.method === 'POST') {
      const body = await leerBody(req)
      const accion = String(body?.accion ?? '')

      if (accion === 'compartir') {
        const entrada = await recibir(body?.texto, 'compartir')
        res.status(200).json({ ok: true, entrada })
        return
      }

      if (accion === 'marcar') {
        const entrada = await marcarEntrada(auth.usuario, body?.id, String(body?.estado ?? ''), body?.movimientoId ?? null)
        res.status(200).json({ ok: true, entrada })
        return
      }

      res.status(400).json({ error: `Acción desconocida: ${accion || '(ninguna)'}` })
      return
    }

    res.status(405).json({ error: 'Método no permitido' })
  } catch (e) {
    if (e instanceof ErrorBandeja) {
      res.status(e.status).json({ error: e.message })
      return
    }
    console.error('[bandeja]', e)
    res.status(500).json({ error: 'No se pudo guardar el cambio. Intenta de nuevo.' })
  }
}
