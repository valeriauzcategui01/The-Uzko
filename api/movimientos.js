import { requireUser } from './_lib/auth.js'
import { leerBody } from './_lib/body.js'
import { conUrls } from './_lib/adjuntos.js'
import { modoAlmacen } from './_lib/store.js'
import {
  ErrorMovimiento,
  anular,
  comentar,
  crear,
  deshacerPago,
  editar,
  listar,
  pagar,
  reactivar,
} from './_lib/movimientos.js'
import { listarCuentas } from './_lib/cuentas.js'
import { listarBandeja } from './_lib/bandeja.js'
import { tasasActuales } from './_lib/tasa.js'

// Un solo endpoint para todo el ciclo del movimiento.
//
//   GET  /api/movimientos   -> todos, más las cuentas, las tasas del día y
//                              cuántas entradas nuevas hay en la bandeja (el
//                              filtrado fino lo hace el navegador; son
//                              cientos al año, no miles)
//   POST /api/movimientos {accion:'crear'|'pagar'|'deshacerPago'|'editar'|
//                          'anular'|'reactivar'|'comentar'}
//
// Una función en vez de siete archivos porque comparten guard, validación y
// manejo de errores, y porque en Vercel cada archivo es una función más que
// arranca en frío.

const ACCIONES = {
  crear: (u, b) => crear(u, b),
  pagar: (u, b) => pagar(u, b.id, b),
  deshacerPago: (u, b) => deshacerPago(u, b.id),
  editar: (u, b) => editar(u, b.id, b),
  anular: (u, b) => anular(u, b.id, b),
  reactivar: (u, b) => reactivar(u, b.id),
  comentar: (u, b) => comentar(u, b.id, b),
}

export default async function handler(req, res) {
  const auth = requireUser(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }
  res.setHeader('Cache-Control', 'private, no-store')

  const almacen = modoAlmacen()
  if (almacen === 'sin-configurar') {
    res.status(503).json({
      error: 'Los movimientos todavía no tienen dónde guardarse. Falta conectar Redis en Vercel (Storage → Upstash) y volver a desplegar.',
      almacen,
    })
    return
  }

  try {
    if (req.method === 'GET') {
      // Todo lo que la app necesita para arrancar, en UNA petición: encadenar
      // cuatro fetches al abrir se nota en el teléfono. Que la tasa o la
      // bandeja fallen no puede impedir ver los gastos.
      const [movimientos, cuentas, tasas, bandeja] = await Promise.all([
        conUrls(await listar()),
        listarCuentas().catch(() => []),
        tasasActuales().catch(() => ({})),
        listarBandeja().catch(() => []),
      ])
      res.status(200).json({
        movimientos,
        cuentas,
        tasas,
        bandejaNuevas: bandeja.filter((e) => e.estado === 'nueva').length,
        almacen,
      })
      return
    }

    if (req.method === 'POST') {
      const body = await leerBody(req)
      // `Object.hasOwn` y no `ACCIONES[x]` a secas: un objeto normal hereda
      // de Object.prototype, y ACCIONES['constructor'] sería una función que
      // pasaría por buena. La acción llega en el cuerpo: la escribe quien
      // quiera.
      const fn = Object.hasOwn(ACCIONES, String(body?.accion ?? '')) ? ACCIONES[body.accion] : null
      if (!fn) {
        res.status(400).json({ error: `Acción desconocida: ${body?.accion ?? '(ninguna)'}` })
        return
      }
      const movimiento = await conUrls(await fn(auth.usuario, body))
      res.status(200).json({ ok: true, movimiento })
      return
    }

    res.status(405).json({ error: 'Método no permitido' })
  } catch (e) {
    if (e instanceof ErrorMovimiento) {
      res.status(e.status).json({ error: e.message })
      return
    }
    console.error('[movimientos]', e)
    res.status(500).json({ error: 'No se pudo guardar el cambio. Intenta de nuevo.' })
  }
}
