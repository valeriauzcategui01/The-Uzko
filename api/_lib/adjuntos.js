import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// FACTURAS Y COMPROBANTES.
//
// El store de Vercel Blob es PRIVADO. No es un detalle de configuración: estas
// fotos traen nombres de empleados, montos y datos bancarios — lo mismo por lo
// que el Excel original nunca entra a git. Un store público las dejaría
// accesibles a cualquiera con el enlace, y el enlace viaja por historiales,
// cabeceras de referencia y capturas de pantalla.
//
// Consecuencia: un adjunto NO tiene una URL estable que se pueda guardar. Lo
// que se guarda en el ticket es su `pathname`; la URL se firma al momento de
// servir el ticket y caduca sola. Así una foto solo la ve quien acaba de pasar
// el muro de contraseña, y un enlace copiado deja de servir en unas horas.
//
// En local no hay Blob: los archivos van a .data/adjuntos/ y se sirven en
// /adjuntos/*, que el servidor de desarrollo enruta.

const HORAS_VALIDEZ = 6

// Vercel conecta el store de dos formas según cuándo se creó: la antigua inyecta
// BLOB_READ_WRITE_TOKEN, y la actual solo inyecta BLOB_STORE_ID y deja que la
// función se identifique con su token OIDC, que el SDK pide y renueva sola. Al
// SDK le sirven las dos, así que aquí valen las dos: mirar solo la primera hacía
// que el store, estando conectado, se diera por ausente y subir contestara que
// no hay dónde guardar.
export const hayBlob = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID)

// Tipos que se aceptan, y la extensión con la que se guardan.
export const TIPOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

// El pathname lo genera el servidor, nunca el cliente. Aun así se valida al
// recibirlo de vuelta: es lo único que impide que alguien adjunte a su ticket
// una ruta arbitraria del store.
export const RUTA_VALIDA = /^recibos\/\d{4}\/[0-9a-f-]{36}\.(jpg|png|webp|heic|pdf)$/

// ── guardar ─────────────────────────────────────────────────────────────────

export async function guardar(buffer, { pathname, contentType }) {
  if (hayBlob()) {
    const { put } = await import('@vercel/blob')
    await put(pathname, buffer, { access: 'private', contentType, addRandomSuffix: false })
    return
  }
  const destino = fileURLToPath(new URL(`../../.data/adjuntos/${pathname}`, import.meta.url))
  mkdirSync(dirname(destino), { recursive: true })
  writeFileSync(destino, buffer)
}

// ── firmar ──────────────────────────────────────────────────────────────────

// Un token por petición, y con él se firman todas las rutas que hagan falta:
// pedirlo cuesta una llamada a Vercel, firmar con él no cuesta ninguna. Por eso
// se firma un lote entero y no adjunto por adjunto.
async function abrirFirmante() {
  if (!hayBlob()) return (p) => `/adjuntos/${p}`

  const { issueSignedToken, presignUrl } = await import('@vercel/blob')
  const token = await issueSignedToken({
    pathname: '*',
    operations: ['get'],
    validUntil: Date.now() + HORAS_VALIDEZ * 60 * 60 * 1000,
  })
  return async (p) => {
    const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname: p, access: 'private' })
    return presignedUrl
  }
}

// Añade la `url` efímera a cada adjunto de cada ticket. No muta lo guardado:
// devuelve copias, para que la URL firmada no acabe escrita en el almacén.
export async function conUrls(tickets) {
  const lista = Array.isArray(tickets) ? tickets : [tickets]
  if (!lista.some((t) => t?.adjuntos?.length)) return tickets

  let firmar
  try {
    firmar = await abrirFirmante()
  } catch (e) {
    // Si el servicio de firma falla, el ticket se sirve igual: se ve todo menos
    // las fotos. Perder el detalle es mejor que perder la pantalla entera.
    console.error('[adjuntos] no se pudieron firmar las URLs:', e)
    return tickets
  }

  const firmados = await Promise.all(
    lista.map(async (t) => {
      if (!t?.adjuntos?.length) return t
      const adjuntos = await Promise.all(
        t.adjuntos.map(async (a) => {
          try {
            return { ...a, url: await firmar(a.pathname) }
          } catch {
            return { ...a, url: null }
          }
        }),
      )
      return { ...t, adjuntos }
    }),
  )

  return Array.isArray(tickets) ? firmados : firmados[0]
}
