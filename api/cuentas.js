import { requireUser } from './_lib/auth.js'
import { leerBody } from './_lib/body.js'
import { ErrorCuenta, archivarCuenta, crearCuenta, editarCuenta, listarCuentas } from './_lib/cuentas.js'

// Las cuentas y tarjetas.
//
//   GET  /api/cuentas   -> la lista (también viaja dentro de /api/movimientos)
//   POST /api/cuentas {accion:'crear'|'editar'|'archivar'|'restaurar'}

const ACCIONES = {
  crear: (u, b) => crearCuenta(u, b),
  editar: (u, b) => editarCuenta(u, b.id, b),
  archivar: (u, b) => archivarCuenta(u, b.id, true),
  restaurar: (u, b) => archivarCuenta(u, b.id, false),
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
      res.status(200).json({ cuentas: await listarCuentas() })
      return
    }

    if (req.method === 'POST') {
      const body = await leerBody(req)
      const fn = Object.hasOwn(ACCIONES, String(body?.accion ?? '')) ? ACCIONES[body.accion] : null
      if (!fn) {
        res.status(400).json({ error: `Acción desconocida: ${body?.accion ?? '(ninguna)'}` })
        return
      }
      const cuenta = await fn(auth.usuario, body)
      // La lista entera de vuelta: es chica y así el navegador no tiene que
      // saber si la acción insertó, cambió o archivó.
      res.status(200).json({ ok: true, cuenta, cuentas: await listarCuentas() })
      return
    }

    res.status(405).json({ error: 'Método no permitido' })
  } catch (e) {
    if (e instanceof ErrorCuenta) {
      res.status(e.status).json({ error: e.message })
      return
    }
    console.error('[cuentas]', e)
    res.status(500).json({ error: 'No se pudo guardar el cambio. Intenta de nuevo.' })
  }
}
