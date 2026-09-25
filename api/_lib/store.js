import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// DÓNDE VIVEN LOS TICKETS.
//
// Los gastos son de solo lectura y viajan dentro del repo. Los tickets no:
// se crean desde el teléfono, cambian de estado y tienen que sobrevivir al
// siguiente despliegue. Eso necesita algo que se pueda escribir.
//
// Dos implementaciones detrás de la misma interfaz:
//
//   producción  Redis (Upstash, el que Vercel conecta desde su marketplace),
//               hablado por su API REST con `fetch` pelado. Sin SDK: son
//               cuatro comandos y el paquete pesaba más que esto.
//               O cualquier Redis por REDIS_URL (el "Redis" gratis que Vercel
//               crea desde Storage), hablado por TCP con el cliente oficial.
//
//   local       un JSON en .data/. `npm run dev` funciona completo sin
//               contratar nada ni tener internet, y como es un archivo se
//               puede abrir para ver qué guardó.
//
// La interfaz es a propósito mínima —lo que los tickets necesitan y nada
// más— para que cambiar de motor un día sea reescribir este archivo solo.

const URL_REDIS = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const TOKEN_REDIS = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN

const REDIS_TCP = process.env.REDIS_URL || process.env.KV_URL

const hayRest = Boolean(URL_REDIS && TOKEN_REDIS)
export const hayRedis = hayRest || Boolean(REDIS_TCP)

// El modo en que está corriendo, para poder avisarlo en la interfaz.
export function modoAlmacen() {
  if (hayRedis) return 'redis'
  return process.env.VERCEL ? 'sin-configurar' : 'archivo'
}

// ── Redis por REST ──────────────────────────────────────────────────────────

// La conexión TCP se abre una vez y se reusa entre peticiones mientras la
// función siga caliente.
let clienteTcp = null
async function tcp() {
  if (!clienteTcp) {
    const { createClient } = await import('redis')
    const c = createClient({ url: REDIS_TCP })
    c.on('error', () => {}) // se reintenta solo; el error real sale en el comando
    clienteTcp = c.connect().then(() => c).catch((e) => {
      clienteTcp = null
      throw e
    })
  }
  return clienteTcp
}

async function cmd(...partes) {
  if (!hayRest) {
    const c = await tcp()
    return c.sendCommand(partes.map(String))
  }
  const r = await fetch(URL_REDIS, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN_REDIS}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(partes),
  })
  if (!r.ok) {
    const detalle = await r.text().catch(() => '')
    throw new Error(`Redis respondió ${r.status}${detalle ? `: ${detalle.slice(0, 200)}` : ''}`)
  }
  const j = await r.json()
  return j.result
}

// ── archivo local ───────────────────────────────────────────────────────────

const RUTA = fileURLToPath(new URL('../../.data/store.json', import.meta.url))

function leerArchivo() {
  try {
    return JSON.parse(readFileSync(RUTA, 'utf8'))
  } catch {
    return {}
  }
}

function escribirArchivo(datos) {
  mkdirSync(dirname(RUTA), { recursive: true })
  writeFileSync(RUTA, JSON.stringify(datos, null, 2), 'utf8')
}

// ── interfaz ────────────────────────────────────────────────────────────────

// Un valor suelto (un ticket). Se guarda serializado en ambos motores para
// que lo que entra y lo que sale sea idéntico en local y en producción.
export async function obtener(clave) {
  if (hayRedis) {
    const v = await cmd('GET', clave)
    return v == null ? null : JSON.parse(v)
  }
  const v = leerArchivo()[clave]
  return v === undefined ? null : v
}

// Varios de golpe, para no hacer N viajes al listar.
export async function obtenerVarios(claves) {
  if (!claves.length) return []
  if (hayRedis) {
    const vs = await cmd('MGET', ...claves)
    return (vs || []).map((v) => (v == null ? null : JSON.parse(v)))
  }
  const datos = leerArchivo()
  return claves.map((c) => (datos[c] === undefined ? null : datos[c]))
}

export async function guardar(clave, valor) {
  if (hayRedis) {
    await cmd('SET', clave, JSON.stringify(valor))
    return
  }
  const datos = leerArchivo()
  datos[clave] = valor
  escribirArchivo(datos)
}

// Índice de ids, más nuevo primero. Es una lista de Redis y no un array
// guardado entero porque LPUSH es atómico: si dos personas crean un ticket
// en el mismo segundo, no se pisan.
export async function empujarAIndice(clave, id) {
  if (hayRedis) {
    await cmd('LPUSH', clave, id)
    return
  }
  const datos = leerArchivo()
  const lista = Array.isArray(datos[clave]) ? datos[clave] : []
  datos[clave] = [id, ...lista]
  escribirArchivo(datos)
}

export async function leerIndice(clave) {
  if (hayRedis) return (await cmd('LRANGE', clave, 0, -1)) || []
  const v = leerArchivo()[clave]
  return Array.isArray(v) ? v : []
}

// Contador para el número visible del ticket (#1, #2…). INCR es atómico, así
// que dos tickets nunca se llevan el mismo número.
export async function siguienteNumero(clave) {
  if (hayRedis) return Number(await cmd('INCR', clave))
  const datos = leerArchivo()
  const n = Number(datos[clave] || 0) + 1
  datos[clave] = n
  escribirArchivo(datos)
  return n
}
