import { obtener, guardar } from './store.js'
import { puedeEscribir } from './auth.js'
import { CATEGORIA_POR_ID } from '../../src/lib/categorias.js'
import { monto } from './numeros.js'

// EL PRESUPUESTO DEL MES: cuánto quiere gastar Valeria en cada categoría.
//
// Un presupuesto por mes, guardado como un mapa categoría → euros. Se guarda
// POR MES y no como "el presupuesto" a secas porque los meses no son iguales
// —diciembre tiene regalos, agosto tiene viajes— y porque así el resumen de
// marzo puede decir cómo le fue a marzo contra lo que marzo se propuso, no
// contra lo que se propone hoy.
//
// El gasto real NO se guarda aquí ni en ningún lado: se deriva de los
// movimientos cada vez que se mira. Un total guardado y su detalle no deben
// poder decir cosas distintas.

const CLAVE = (mes) => `presupuesto:${mes}`
const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/

class ErrorPresupuesto extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje)
    this.status = status
  }
}
export { ErrorPresupuesto }

export function mesValido(v) {
  return MES_VALIDO.test(String(v ?? ''))
}

export async function leerPresupuesto(mes) {
  if (!mesValido(mes)) throw new ErrorPresupuesto('Ese mes no se entiende (formato 2026-09)')
  return (await obtener(CLAVE(mes))) ?? null
}

// Guarda el mapa entero del mes: lo que no venga queda en cero. Es más simple
// que un merge campo a campo, y el formulario siempre manda la lista completa.
export async function guardarPresupuesto(usuario, mes, porCategoria) {
  if (!puedeEscribir(usuario)) throw new ErrorPresupuesto('Tu acceso es de solo lectura', 403)
  if (!mesValido(mes)) throw new ErrorPresupuesto('Ese mes no se entiende (formato 2026-09)')

  const limpio = {}
  for (const [id, valor] of Object.entries(porCategoria ?? {})) {
    // Solo categorías de gasto que existan: un presupuesto para una categoría
    // inventada sumaría en el total sin poder verse en ninguna fila. Y las de
    // ingreso no se presupuestan aquí: esto es el techo del gasto.
    if (!Object.hasOwn(CATEGORIA_POR_ID, id) || CATEGORIA_POR_ID[id].ingreso) continue
    const n = monto(valor)
    if (n != null && n > 0) limpio[id] = n
  }

  const presupuesto = {
    mes,
    porCategoria: limpio,
    actualizadoEl: new Date().toISOString(),
    por: { id: usuario.id, nombre: usuario.nombre },
  }
  await guardar(CLAVE(mes), presupuesto)
  return presupuesto
}
