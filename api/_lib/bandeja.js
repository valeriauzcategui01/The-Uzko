import { randomUUID } from 'node:crypto'
import { obtener, obtenerVarios, guardar, empujarAIndice, leerIndice } from './store.js'
import { puedeEscribir } from './auth.js'
import { parsearMensaje } from './parser.js'
import { categorizar } from '../../src/lib/categorias.js'

// LA BANDEJA DE ENTRADA: los mensajes del banco que llegaron solos.
//
// El teléfono de Valerio reenvía los SMS del banco a /api/inbox (vía un
// automatizador tipo MacroDroid) y aquí se guardan ya leídos: monto, moneda,
// comercio y una categoría propuesta. NO se convierten en gasto directamente
// —un parser que se equivoca y registra solo es un mes entero que miente—:
// esperan en la bandeja a que ella los confirme con un toque, y al confirmar
// nace el movimiento por el camino normal, con su validación y su tasa.
//
// Cada entrada guarda el texto original completo: si el parser leyó mal, la
// persona ve el mensaje tal cual llegó y corrige.

const CLAVE = (id) => `entrada:${id}`
const INDICE = 'bandeja:indice'

// La bandeja no crece sin límite: se listan las últimas 100. Las viejas
// siguen guardadas por si hay que auditar, pero no viajan en cada carga.
const MAX_LISTA = 100

class ErrorBandeja extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje)
    this.status = status
  }
}
export { ErrorBandeja }

export async function recibir(texto, origen = 'sms') {
  const limpio = String(texto ?? '').trim().slice(0, 2000)
  if (!limpio) throw new ErrorBandeja('El mensaje llegó vacío')

  const parse = parsearMensaje(limpio)
  const entrada = {
    id: randomUUID(),
    texto: limpio,
    origen: ['sms', 'compartir', 'correo'].includes(origen) ? origen : 'sms',
    parse,
    // La categoría se propone por el comercio ("MERCADONA" → mercado), con
    // las mismas reglas que usa el buscador. Es una propuesta: se confirma o
    // se cambia en el formulario, nunca se registra sola.
    categoriaPropuesta: parse.comercio || parse.monto ? categorizar(`${parse.comercio} ${limpio}`) : 'otros',
    estado: 'nueva', // nueva | usada | descartada
    recibidoEl: new Date().toISOString(),
  }
  await guardar(CLAVE(entrada.id), entrada)
  await empujarAIndice(INDICE, entrada.id)
  return entrada
}

export async function listarBandeja() {
  const ids = (await leerIndice(INDICE)).slice(0, MAX_LISTA)
  if (!ids.length) return []
  const crudas = await obtenerVarios(ids.map(CLAVE))
  return crudas.filter(Boolean)
}

// Marcarla usada (nació un movimiento de ella) o descartada (era publicidad,
// un duplicado, un aviso que no es un gasto). No se borra: el texto original
// es la única prueba de qué llegó y qué se decidió hacer con él.
export async function marcarEntrada(usuario, id, estado, movimientoId = null) {
  if (!puedeEscribir(usuario)) throw new ErrorBandeja('Tu acceso es de solo lectura', 403)
  if (!['usada', 'descartada', 'nueva'].includes(estado)) throw new ErrorBandeja('Estado desconocido')
  const e = await obtener(CLAVE(String(id || '')))
  if (!e) throw new ErrorBandeja('Esa entrada no existe', 404)
  e.estado = estado
  e.movimientoId = estado === 'usada' ? movimientoId : null
  e.decididoEl = new Date().toISOString()
  e.decididoPor = { id: usuario.id, nombre: usuario.nombre }
  await guardar(CLAVE(e.id), e)
  return e
}
