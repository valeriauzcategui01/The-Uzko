import { requireUser } from './_lib/auth.js'
import { leerBody } from './_lib/body.js'
import { conUrls } from './_lib/adjuntos.js'
import { modoAlmacen } from './_lib/store.js'
import { CASAS, ErrorTicket, cancelar, comentar, crear, editar, listar, pagar, reabrir } from './_lib/tickets.js'
import { tasasActuales } from './_lib/tasa.js'

// Un solo endpoint para todo el ciclo del ticket.
//
//   GET  /api/tickets                 -> todos (el filtrado fino lo hace el
//                                        navegador; son decenas, no miles)
//   POST /api/tickets {accion:'crear'|'pagar'|'cancelar'|'reabrir'|'comentar'}
//
// Una función en vez de cinco archivos porque comparten guard, validación y
// manejo de errores, y porque en Vercel cada archivo es una función más que
// arranca en frío.

const ACCIONES = {
  crear: (u, b) => crear(u, b),
  pagar: (u, b) => pagar(u, b.id, b),
  cancelar: (u, b) => cancelar(u, b.id, b),
  reabrir: (u, b) => reabrir(u, b.id),
  comentar: (u, b) => comentar(u, b.id, b),
  editar: (u, b) => editar(u, b.id, b),
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
      error: 'Los tickets todavía no tienen dónde guardarse. Falta conectar Redis en Vercel (Storage → Upstash) y volver a desplegar.',
      almacen,
    })
    return
  }

  try {
    // `conUrls` añade a cada adjunto un enlace firmado que caduca. Se hace al
    // salir y no al guardar porque el store es privado: la URL no es un dato
    // del ticket, es un permiso temporal para quien acaba de identificarse.
    if (req.method === 'GET') {
      // La tasa viaja con los tickets porque la vista la necesita para pintar
      // el primer ticket, y encadenar dos peticiones al abrir se nota en el
      // teléfono. Que falle no puede impedir ver lo que hay que pagar: si no
      // hay tasa, se muestra todo igual y solo no se puede teclear en Bs.
      const [tickets, tasas] = await Promise.all([
        conUrls(await listar(auth.usuario)),
        tasasActuales().catch(() => ({})),
      ])
      // `tasas` es { usd, eur }, cada una con su estado o null: el euro puede
      // faltar sin que el dólar falte. Se manda también `tasa` a secas, la del
      // dólar, para que una pestaña abierta con la versión anterior siga
      // pintando la barra en vez de quedarse en blanco.
      res.status(200).json({ tickets, casas: CASAS, tasas, tasa: tasas.usd ?? null, almacen })
      return
    }

    if (req.method === 'POST') {
      const body = await leerBody(req)
      // `Object.hasOwn` y no `ACCIONES[x]` a secas: un objeto normal hereda de
      // Object.prototype, así que ACCIONES['toString'] o ['constructor'] son
      // funciones y pasarían por buenas. Con 'constructor' esto llegaba a
      // responder 200 con `Object(usuario, body)` dentro, que es el usuario de
      // la sesión. La acción llega en el cuerpo de la petición: la escribe
      // quien quiera.
      const fn = Object.hasOwn(ACCIONES, String(body?.accion ?? '')) ? ACCIONES[body.accion] : null
      if (!fn) {
        res.status(400).json({ error: `Acción desconocida: ${body?.accion ?? '(ninguna)'}` })
        return
      }
      const ticket = await conUrls(await fn(auth.usuario, body))
      res.status(200).json({ ok: true, ticket })
      return
    }

    res.status(405).json({ error: 'Método no permitido' })
  } catch (e) {
    if (e instanceof ErrorTicket) {
      res.status(e.status).json({ error: e.message })
      return
    }
    // Un fallo del almacén no debería filtrar detalles del servidor, pero sí
    // decir con claridad que no fue culpa de quien lo intentó.
    console.error('[tickets]', e)
    res.status(500).json({ error: 'No se pudo guardar el cambio. Intenta de nuevo.' })
  }
}
