import { requireUser, puedeCambiarTasa } from './_lib/auth.js'
import { leerBody } from './_lib/body.js'
import { monto } from './_lib/numeros.js'
import { MONEDAS, fijarManual, tasasActuales, volverAutomatica } from './_lib/tasa.js'

// La tasa del día, para verla y para corregirla.
//
//   GET  /api/tasa                  -> la que rige ahora mismo
//   POST /api/tasa {bs:'795,20'}    -> corregirla a mano, solo por hoy
//   POST /api/tasa {accion:'auto'}  -> deshacer la corrección y volver al BCV
//
// La vista de tickets no necesita llamar al GET: la tasa viaja dentro de
// /api/tickets para no encadenar dos peticiones al abrir. Esto es para
// cambiarla, y para quien la quiera consultar suelta.

export default async function handler(req, res) {
  const auth = requireUser(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }
  res.setHeader('Cache-Control', 'private, no-store')

  try {
    if (req.method === 'GET') {
      const tasas = await tasasActuales()
      res.status(200).json({ tasas, tasa: tasas.usd ?? null })
      return
    }

    if (req.method === 'POST') {
      // Corregir la tasa cambia a cuánto se va a convertir cada gasto que se
      // registre hoy.
      if (!puedeCambiarTasa(auth.usuario)) {
        res.status(403).json({ error: 'Tu acceso es de solo lectura' })
        return
      }
      const body = await leerBody(req)

      // Cuál se corrige. Hoy la pantalla solo ofrece el dólar; el euro se
      // acepta aquí para no tener que volver cuando haga falta.
      const moneda = MONEDAS.includes(body?.moneda) ? body.moneda : 'usd'

      if (body?.accion === 'auto') {
        await volverAutomatica(moneda)
        const tasas = await tasasActuales()
        res.status(200).json({ ok: true, tasas, tasa: tasas.usd ?? null })
        return
      }

      const tasa = await fijarManual(auth.usuario, monto(body?.bs), moneda)
      if (!tasa) {
        res.status(400).json({ error: 'Esa tasa no se entiende. Escribe cuántos bolívares vale un dólar, por ejemplo 795,20' })
        return
      }
      const tasas = await tasasActuales()
      res.status(200).json({ ok: true, tasas, tasa: tasas.usd ?? null })
      return
    }

    res.status(405).json({ error: 'Método no permitido' })
  } catch (e) {
    console.error('[tasa]', e)
    res.status(500).json({ error: 'No se pudo leer la tasa del día' })
  }
}
