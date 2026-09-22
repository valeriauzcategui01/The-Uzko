import { randomUUID } from 'node:crypto'
import { obtener, guardar } from './store.js'
import { puedeEscribir } from './auth.js'

// LAS CUENTAS Y TARJETAS de Valeria: de dónde sale (o a dónde entra) el
// dinero de cada movimiento.
//
// Son pocas y cambian poco, así que viven todas en UNA clave del almacén, como
// un array. No hace falta el aparato de índice + clave-por-registro de los
// movimientos: aquello existe porque LPUSH es atómico y dos personas pueden
// crear a la vez; aquí escribe una persona un par de veces al año.
//
// Una cuenta no se borra: se archiva. Los movimientos viejos la referencian
// por id, y borrarla dejaría "¿de qué tarjeta salió esto?" sin respuesta.

const CLAVE = 'cuentas:lista'

export const TIPOS_CUENTA = ['debito', 'credito', 'efectivo', 'otra']
export const MONEDAS_CUENTA = ['eur', 'usd', 'bs']

// Colores que combinan con la paleta de categorías sin pisarla.
const COLOR_DEFECTO = '#6366f1'
const ES_COLOR = /^#[0-9a-fA-F]{6}$/

class ErrorCuenta extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje)
    this.status = status
  }
}
export { ErrorCuenta }

function texto(v, max) {
  const s = String(v ?? '').trim()
  return s.length > max ? s.slice(0, max) : s
}

export async function listarCuentas() {
  const lista = await obtener(CLAVE)
  return Array.isArray(lista) ? lista : []
}

// La usa el motor de movimientos para validar el campo `cuenta`. Una cuenta
// archivada sigue siendo válida A PROPÓSITO: se archiva para que no salga en
// el formulario, no para invalidar la historia que ya la nombra.
export async function esCuentaValida(id) {
  const lista = await listarCuentas()
  return lista.some((c) => c.id === id)
}

function validar(datos) {
  const nombre = texto(datos.nombre, 60)
  if (!nombre) throw new ErrorCuenta('La cuenta necesita un nombre: "Visa BBVA", "Efectivo"…')
  const tipo = TIPOS_CUENTA.includes(datos.tipo) ? datos.tipo : 'otra'
  const moneda = MONEDAS_CUENTA.includes(datos.moneda) ? datos.moneda : 'eur'
  const color = ES_COLOR.test(String(datos.color ?? '')) ? datos.color : COLOR_DEFECTO
  return { nombre, tipo, moneda, color }
}

export async function crearCuenta(usuario, datos) {
  if (!puedeEscribir(usuario)) throw new ErrorCuenta('Tu acceso es de solo lectura', 403)
  const lista = await listarCuentas()
  const cuenta = {
    id: randomUUID(),
    ...validar(datos),
    archivada: false,
    creadaPor: { id: usuario.id, nombre: usuario.nombre },
    creadaEl: new Date().toISOString(),
  }
  await guardar(CLAVE, [...lista, cuenta])
  return cuenta
}

export async function editarCuenta(usuario, id, datos) {
  if (!puedeEscribir(usuario)) throw new ErrorCuenta('Tu acceso es de solo lectura', 403)
  const lista = await listarCuentas()
  const i = lista.findIndex((c) => c.id === id)
  if (i === -1) throw new ErrorCuenta('Esa cuenta no existe', 404)
  lista[i] = { ...lista[i], ...validar({ ...lista[i], ...datos }) }
  await guardar(CLAVE, lista)
  return lista[i]
}

export async function archivarCuenta(usuario, id, archivada = true) {
  if (!puedeEscribir(usuario)) throw new ErrorCuenta('Tu acceso es de solo lectura', 403)
  const lista = await listarCuentas()
  const i = lista.findIndex((c) => c.id === id)
  if (i === -1) throw new ErrorCuenta('Esa cuenta no existe', 404)
  lista[i] = { ...lista[i], archivada: Boolean(archivada) }
  await guardar(CLAVE, lista)
  return lista[i]
}
