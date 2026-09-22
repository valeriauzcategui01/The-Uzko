// Configuración central de la app.
//
// Las categorías NO se definen aquí: hay una sola lista, en
// src/lib/categorias.js, y la usan los tres que la necesitan — este archivo
// para pintarla, el servidor para validar lo que llega, y el clasificador de
// la bandeja para proponer categoría al leer un SMS. Se re-exporta para no
// tocar los sitios que hacen `from '../../config'`.
export {
  CATEGORIAS,
  CATEGORIAS_GASTO,
  CATEGORIAS_INGRESO,
  CATEGORIA_POR_ID,
} from './lib/categorias.js'

import { CATEGORIA_POR_ID as PorId } from './lib/categorias.js'

export const categoriaLabel = (id) => PorId[id]?.label ?? 'Otros'
export const categoriaColor = (id) => PorId[id]?.color ?? '#94a3b8'

// La contabilidad se lleva en EUROS: es la moneda del presupuesto y de todos
// los totales. Los dólares y bolívares se guardan al lado como el dato de en
// qué se pagó, nunca como el número principal.
export const MONEDA = { locale: 'es-ES', code: 'EUR' }

// Tipos de cuenta, para el formulario y las etiquetas. La lista que valida
// el servidor está en api/_lib/cuentas.js y es la misma.
export const TIPOS_CUENTA = [
  { id: 'debito', label: 'Débito' },
  { id: 'credito', label: 'Crédito' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'otra', label: 'Otra' },
]

export const MONEDAS_APP = [
  { id: 'eur', simbolo: '€', nombre: 'euros', placeholder: '23,50' },
  { id: 'usd', simbolo: '$', nombre: 'dólares', placeholder: '25' },
  { id: 'bs', simbolo: 'Bs', nombre: 'bolívares', placeholder: '1.250,00' },
]
