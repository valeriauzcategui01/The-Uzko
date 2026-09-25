import { createHmac, createHash, timingSafeEqual } from 'node:crypto'

// EL ACCESO.
//
// HOY: una sola contraseña (SITE_PASSWORD en Vercel). Valeria la escribe y
// entra como "Valeria", administradora de todo. Es lo que Eduardo pidió el
// 22/09/2026: sin usuarios por ahora.
//
// El sistema de personas (variable USUARIOS, heredado de Sosa Baserva) sigue
// aquí abajo, dormido, porque cada gasto firma quién lo registró y el día que
// haga falta un segundo acceso —o uno de solo-mirar— basta con poner la
// variable, sin tocar código. Mientras USUARIOS no exista, manda
// SITE_PASSWORD.
//
// Config (Vercel → Environment Variables):
//
//   SITE_PASSWORD  -> LA contraseña de la app.
//
//   SESSION_SECRET -> (opcional) firma la cookie. Cambiarlo cierra todas las
//                     sesiones abiertas sin tener que cambiar la contraseña.
//
//   USUARIOS       -> (dormida) JSON de personas con hash sha256(id:clave);
//                     al ponerla, la pantalla de entrada pasa sola al modo
//                     de elegir persona. Roles: admin (todo) | invitado
//                     (solo mira).

const COOKIE = 'uzko_auth'
const SECRET = process.env.SESSION_SECRET || process.env.SITE_PASSWORD || 'dev'

export const ROLES = ['admin', 'invitado']

// Los permisos se escriben como LISTAS DE QUIÉN SÍ. Un rol que se añada mañana
// nace sin poder escribir y hay que darle el permiso a propósito.

// Puede registrar movimientos, editar, anular, y manejar cuentas/presupuesto.
export const puedeEscribir = (u) => u?.rol === 'admin'

// Puede corregir la tasa del día a mano.
export const puedeCambiarTasa = (u) => u?.rol === 'admin'

// Lo que el navegador necesita saber para dibujar. Se calcula AQUÍ y viaja en
// /api/session. El servidor lo vuelve a comprobar en cada endpoint — esto es
// para pintar, no para proteger.
export const permisosDe = (u) => ({
  escribir: puedeEscribir(u),
  cambiarTasa: puedeCambiarTasa(u),
})

// La clave se guarda como sha256(id:clave). El id hace de sal, así dos
// personas con la misma clave no comparten hash. No es bcrypt, pero esto es
// una app personal detrás de un muro: el riesgo real es que alguien vea la
// variable en Vercel, y ahí el hash ya evita que se lleve la clave en claro.
export function hashClave(id, clave) {
  return createHash('sha256').update(`${String(id).trim()}:${String(clave).trim()}`).digest('hex')
}

function parseUsuarios() {
  const raw = process.env.USUARIOS
  if (!raw) return null
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr) || !arr.length) return null
    return arr
      .filter((u) => u && u.id && u.hash)
      .map((u) => ({
        id: String(u.id).trim(),
        nombre: String(u.nombre || u.id).trim(),
        rol: ROLES.includes(u.rol) ? u.rol : 'admin',
        hash: String(u.hash).trim(),
      }))
  } catch {
    // Un JSON mal pegado no puede tumbar el sitio: se cae a SITE_PASSWORD y
    // el aviso sale en /api/session, que es donde el frontend puede mostrarlo.
    return null
  }
}

// El usuario de compatibilidad: existe solo cuando no hay USUARIOS todavía.
const USUARIO_UNICO = { id: 'uzko', nombre: 'Valeria', rol: 'admin' }
const USUARIO_DEV = { id: 'dev', nombre: 'Desarrollo', rol: 'admin' }

// Lista para la pantalla de entrada. NUNCA incluye el hash.
export function usuariosPublicos() {
  const us = parseUsuarios()
  if (!us) return []
  return us.map(({ id, nombre, rol }) => ({ id, nombre, rol }))
}

export function modoAcceso() {
  if (parseUsuarios()) return 'personas'
  if (process.env.SITE_PASSWORD) return 'clave-unica'
  return 'abierto'
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

// ── sesión ──────────────────────────────────────────────────────────────────

// El token lleva el id adentro y va firmado, así el servidor sabe quién eres
// sin guardar sesiones en ningún lado: `id.firma(id)`.
export function makeToken(id) {
  const firma = createHmac('sha256', SECRET).update(`uzko-v1:${id}`).digest('hex')
  return `${id}.${firma}`
}

function leerToken(token) {
  const i = String(token || '').lastIndexOf('.')
  if (i <= 0) return null
  const id = token.slice(0, i)
  return safeEqual(token, makeToken(id)) ? id : null
}

function getCookie(req, name) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[1]) : null
}

export function cookieHeader(token) {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`
}
export function clearCookieHeader() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

// ── entrar ──────────────────────────────────────────────────────────────────

// Devuelve el usuario si las credenciales sirven, o null.
export function autenticar({ id, clave }) {
  const us = parseUsuarios()

  if (us) {
    const u = us.find((x) => x.id === String(id || '').trim())
    if (!u) return null
    return safeEqual(hashClave(u.id, clave), u.hash) ? { id: u.id, nombre: u.nombre, rol: u.rol } : null
  }

  const pw = process.env.SITE_PASSWORD
  if (pw) {
    return safeEqual(String(clave ?? '').trim(), String(pw).trim()) ? USUARIO_UNICO : null
  }

  // Sin nada configurado solo se entra en local.
  return process.env.VERCEL ? null : USUARIO_DEV
}

// Quién es el que está pidiendo, a partir de la cookie.
export function usuarioDe(req) {
  const modo = modoAcceso()

  if (modo === 'abierto') {
    // Sin SITE_PASSWORD se entra directo, también en producción: Valeria
    // pidió entrar sin clave. Basta con poner SITE_PASSWORD en Vercel (y
    // redesplegar) para que la app vuelva a pedirla.
    return process.env.VERCEL ? USUARIO_UNICO : USUARIO_DEV
  }

  const id = leerToken(getCookie(req, COOKIE))
  if (!id) return null

  if (modo === 'clave-unica') return id === USUARIO_UNICO.id ? USUARIO_UNICO : null

  const u = parseUsuarios().find((x) => x.id === id)
  return u ? { id: u.id, nombre: u.nombre, rol: u.rol } : null
}

// Guard para los endpoints. Devuelve el usuario, no solo un sí/no, porque
// todo lo que se escribe necesita saber quién actúa.
export function requireUser(req) {
  const usuario = usuarioDe(req)
  if (!usuario) return { ok: false, status: 401, error: 'No autenticado' }
  return { ok: true, usuario }
}
