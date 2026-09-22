import { randomUUID } from 'node:crypto'
import { requireUser } from './_lib/auth.js'
import { leerBody } from './_lib/body.js'
import { TIPOS, guardar, hayBlob } from './_lib/adjuntos.js'

// Recibe una factura o un comprobante y lo guarda.
//
// El archivo llega en base64 dentro del JSON en vez de como multipart. Es menos
// elegante, pero el cliente ya reduce las fotos antes de mandarlas (una factura
// de 6 MB baja a ~200 KB sin perder legibilidad), así que el sobrecosto del
// base64 es irrelevante y el código se queda en una página en vez de tres.
//
// Devuelve el `pathname`, no una URL: el store es privado y las URLs se firman
// al servir, no al guardar. Ver api/_lib/adjuntos.js.

// 4 MB ya decodificado. Vercel corta el cuerpo de la petición cerca de 4,5 MB y
// el base64 abulta un tercio, así que este techo va con margen.
const MAX = 4 * 1024 * 1024

export default async function handler(req, res) {
  const auth = requireUser(req)
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error })
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }
  if (!hayBlob() && process.env.VERCEL) {
    res.status(503).json({
      error: 'Todavía no hay dónde guardar los archivos. Falta conectar el Blob store en Vercel y volver a desplegar.',
    })
    return
  }

  const body = await leerBody(req)
  const contentType = String(body?.contentType || '').toLowerCase()
  // Mismo motivo que en api/tickets.js: `contentType` lo manda el cliente, y
  // TIPOS['toString'] sería una función heredada, no una extensión.
  const ext = Object.hasOwn(TIPOS, contentType) ? TIPOS[contentType] : null
  if (!ext) {
    res.status(400).json({ error: 'Solo se pueden subir fotos (JPG, PNG, WEBP, HEIC) o PDF' })
    return
  }

  const base64 = String(body?.datos || '').replace(/^data:[^;]+;base64,/, '')
  let buffer
  try {
    buffer = Buffer.from(base64, 'base64')
  } catch {
    res.status(400).json({ error: 'El archivo llegó dañado' })
    return
  }
  if (!buffer.length) {
    res.status(400).json({ error: 'El archivo llegó vacío' })
    return
  }
  if (buffer.length > MAX) {
    res.status(413).json({ error: 'El archivo pesa demasiado. Máximo 4 MB.' })
    return
  }

  // El nombre original solo se conserva para mostrarlo; la ruta la decide el
  // servidor, así que nada de lo que mande el cliente llega al sistema de
  // archivos ni al store.
  const nombre = String(body?.nombre || `adjunto.${ext}`).replace(/[^\w.\- ]+/g, '').slice(-80) || `adjunto.${ext}`
  const pathname = `recibos/${new Date().getFullYear()}/${randomUUID()}.${ext}`

  try {
    await guardar(buffer, { pathname, contentType })
    res.status(200).json({ ok: true, pathname, nombre, contentType })
  } catch (e) {
    console.error('[subir]', e)
    res.status(500).json({ error: 'No se pudo subir el archivo. Intenta de nuevo.' })
  }
}
