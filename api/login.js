import { autenticar, makeToken, cookieHeader, modoAcceso } from './_lib/auth.js'
import { leerBody } from './_lib/body.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }

  const modo = modoAcceso()
  if (modo === 'abierto' && process.env.VERCEL) {
    res.status(503).json({
      ok: false,
      error: 'El sitio todavía no tiene acceso configurado. Falta la variable USUARIOS (o SITE_PASSWORD) en Vercel y volver a desplegar.',
    })
    return
  }

  const body = await leerBody(req)
  // `password` es el nombre que usaba la versión de clave única: se acepta
  // para que un navegador con la pantalla vieja en caché siga entrando.
  const clave = body?.clave ?? body?.password ?? ''
  const id = body?.id ?? 'uzko'

  const usuario = autenticar({ id, clave })
  if (!usuario) {
    // El mismo mensaje para "no existe esa persona" y "clave equivocada": no
    // hace falta confirmarle a nadie qué nombres son válidos.
    res.status(401).json({ ok: false, error: 'Nombre o contraseña incorrectos' })
    return
  }

  res.setHeader('Set-Cookie', cookieHeader(makeToken(usuario.id)))
  res.status(200).json({ ok: true, usuario })
}
