import { randomUUID } from 'node:crypto'
import { obtener, obtenerVarios, guardar, empujarAIndice, leerIndice, siguienteNumero } from './store.js'
import { puedeEscribir } from './auth.js'
import { RUTA_VALIDA } from './adjuntos.js'
import { CATEGORIA_POR_ID } from '../../src/lib/categorias.js'
import { monto, bsAEuros, usdAEuros } from './numeros.js'
import { diaCaracas, tasaActual } from './tasa.js'
import { esCuentaValida } from './cuentas.js'

// EL MOVIMIENTO: un gasto o un ingreso de Valerio, con su recibo al lado.
//
// Es el motor de tickets de Sosa Baserva adaptado a finanzas personales. La
// diferencia de fondo: allá un ticket nacía pendiente ("hay que pagarle al
// jardinero") y alguien lo pagaba después; aquí lo normal es registrar algo
// que YA se pagó —el ticket del súper, la compra que avisó el banco— así que
// el movimiento nace registrado, y "por pagar" es el caso especial para
// cuentas que vencen (el alquiler, la factura del teléfono).
//
// ESTADOS
//
//   registrado ──anular──> anulado ──reactivar──> registrado
//   porPagar ──pagar──> registrado ──deshacerPago──> porPagar
//   porPagar ──anular──> anulado
//
// Nada se borra nunca: anular es un estado, no una eliminación, y cada cambio
// deja una línea en el historial con quién y cuándo.

const CLAVE = (id) => `mov:${id}`
const INDICE = 'movs:indice'
const CONTADOR = 'movs:numero'

export const ESTADOS = ['registrado', 'porPagar', 'anulado']
export const TIPOS_MOV = ['gasto', 'ingreso']

const ahora = () => new Date().toISOString()

// El historial se guarda como frases ya escritas, con los números en español.
const cifra = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const quien = (u) => ({ id: u.id, nombre: u.nombre })

function texto(v, max) {
  const s = String(v ?? '').trim()
  return s.length > max ? s.slice(0, max) : s
}

// Fechas de solo día ("2026-09-22"). `new Date('2026-02-31')` NO da error,
// desborda callado al 3 de marzo: por eso se re-escribe la fecha interpretada
// y se compara con la que llegó. Anclada al mediodía, la única hora que
// ningún huso mueve de día.
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/

function dia(v) {
  const s = String(v ?? '').trim()
  if (!SOLO_DIA.test(s)) return null
  const d = new Date(`${s}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const vuelta = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return vuelta === s ? s : null
}

export { monto }

class ErrorMovimiento extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje)
    this.status = status
  }
}
export { ErrorMovimiento }

// ── leer ────────────────────────────────────────────────────────────────────

export async function listar() {
  const ids = await leerIndice(INDICE)
  if (!ids.length) return []
  const crudos = await obtenerVarios(ids.map(CLAVE))
  return crudos.filter(Boolean)
}

export async function leer(id) {
  const t = await obtener(CLAVE(String(id || '')))
  if (!t) throw new ErrorMovimiento('Ese movimiento no existe', 404)
  return t
}

// ── el monto, venga en la moneda que venga ──────────────────────────────────

// La contabilidad se lleva en EUROS: es la cifra con la que se decide y la
// que suman los totales y el presupuesto. Se convierte al entrar, una sola
// vez, en el servidor —la tasa del navegador puede llevar horas abierta en
// una pestaña; lo que se ve mientras se teclea es una previsualización.
//
// Y se guarda además lo que se tecleó y la tasa que se usó, porque un
// "€46,55" suelto no se puede recomponer seis meses después. Con la tasa al
// lado es "Bs 4.200 cuando el euro estaba a 922,69", y esa frase sí se puede
// auditar. El BCV publica el dólar y el euro cada uno contra el bolívar; el
// cambio dólar→euro sale de cruzar sus dos cifras del mismo día.
const NOMBRE_MONEDA = { eur: 'euros', usd: 'dólares', bs: 'bolívares' }

async function enEuros(valor, moneda) {
  const n = monto(valor)
  if (n == null) return { eur: null, original: null }

  // Euros: no hay nada que convertir ni tasa que recordar.
  if (moneda !== 'bs' && moneda !== 'usd') return { eur: n, original: null }

  const tEur = await tasaActual('eur')
  if (!tEur?.bs) throw new ErrorMovimiento(sinTasa('eur'))

  if (moneda === 'bs') {
    return {
      eur: bsAEuros(n, tEur.bs),
      original: { moneda: 'bs', valor: n, tasa: { eur: tEur.bs, dia: tEur.dia, fuente: tEur.fuente, origen: tEur.origen } },
    }
  }

  // Dólares. Hacen falta LAS DOS tasas del día para cruzarlas.
  const tUsd = await tasaActual('usd')
  if (!tUsd?.bs) throw new ErrorMovimiento(sinTasa('usd'))

  return {
    eur: usdAEuros(n, tUsd.bs, tEur.bs),
    original: {
      moneda: 'usd',
      valor: n,
      tasa: { eur: tEur.bs, usd: tUsd.bs, dia: tEur.dia, fuente: tEur.fuente, origen: tEur.origen },
    },
  }
}

function sinTasa(moneda) {
  return `No hay tasa del día para convertir de ${NOMBRE_MONEDA[moneda] ?? moneda}. Escríbela a mano en la barra de tasas, o teclea el monto en euros.`
}

// El historial cuenta lo que pasó, no lo que se guardó.
function fraseDelMonto(eur, original) {
  if (original?.moneda === 'bs') return `Bs ${cifra.format(original.valor)} · ${cifra.format(eur)} € al cambio del ${original.tasa.dia}`
  if (original?.moneda === 'usd') return `$ ${cifra.format(original.valor)} · ${cifra.format(eur)} € al cambio del ${original.tasa.dia}`
  return `${cifra.format(eur)} €`
}

// ── validaciones compartidas ────────────────────────────────────────────────

// La categoría se escoge de una lista, no se escribe, y tiene que cuadrar con
// el tipo: un ingreso no puede caer en "Mercado" ni un gasto en "Sueldo".
// `Object.hasOwn` y no `if (CATEGORIA_POR_ID[id])`: ese objeto hereda de
// Object.prototype, y "toString" o "constructor" pasarían por categorías.
function validarCategoria(idCategoria, tipo) {
  const id = String(idCategoria ?? '')
  if (!Object.hasOwn(CATEGORIA_POR_ID, id)) throw new ErrorMovimiento('Hay que escoger de qué es el movimiento')
  const esIngreso = Boolean(CATEGORIA_POR_ID[id].ingreso)
  if (esIngreso !== (tipo === 'ingreso')) {
    throw new ErrorMovimiento(tipo === 'ingreso' ? 'Esa categoría es de gastos' : 'Esa categoría es de ingresos')
  }
  return id
}

// La cuenta es opcional —no todo gasto sale de una tarjeta—, pero si viene
// tiene que existir.
async function validarCuenta(idCuenta) {
  const id = String(idCuenta ?? '').trim()
  if (!id) return null
  if (!(await esCuentaValida(id))) throw new ErrorMovimiento('Esa cuenta o tarjeta no existe')
  return id
}

// ── crear ───────────────────────────────────────────────────────────────────

// `datos.estado` decide cómo nace: 'registrado' (lo normal: ya se pagó) o
// 'porPagar' (una cuenta que vence). Todo lo demás es igual en los dos.
export async function crear(usuario, datos) {
  if (!puedeEscribir(usuario)) throw new ErrorMovimiento('Tu acceso es de solo lectura', 403)

  const titulo = texto(datos.titulo, 120)
  if (!titulo) throw new ErrorMovimiento('El movimiento necesita un título: qué se pagó o qué entró')

  const tipo = datos.tipo === 'ingreso' ? 'ingreso' : 'gasto'
  const categoria = validarCategoria(datos.categoria, tipo)
  const cuenta = await validarCuenta(datos.cuenta)

  const porPagar = datos.estado === 'porPagar'
  // Un ingreso "por pagar" no existe: lo que aún no entró no se registra.
  if (porPagar && tipo === 'ingreso') throw new ErrorMovimiento('Un ingreso se registra cuando entra, no antes')

  const { eur, original } = await enEuros(datos.monto, datos.moneda)
  // Registrado sin monto no tiene sentido —ya se pagó, la cifra existe—;
  // por pagar sí puede nacer sin cifra ("va a llegar la factura de la luz").
  if (!porPagar && eur == null) throw new ErrorMovimiento('Falta cuánto fue')

  const numero = await siguienteNumero(CONTADOR)
  const el = ahora()

  const mov = {
    id: randomUUID(),
    numero,
    tipo,
    titulo,
    categoria,
    cuenta,
    descripcion: texto(datos.descripcion, 2000),
    estado: porPagar ? 'porPagar' : 'registrado',
    // El día del gasto decide en qué mes suma. El formulario siempre lo
    // manda; el respaldo es el día de Caracas y no el del servidor, que
    // corre en UTC y de noche ya está en mañana.
    fecha: porPagar ? null : (dia(datos.fecha) ?? diaCaracas()),
    paraCuando: porPagar ? dia(datos.paraCuando) : null,
    montoEur: eur,
    original,
    adjuntos: normalizarAdjuntos(datos.adjuntos, 'recibo', usuario, el),
    // De dónde salió: 'manual' del formulario, 'bandeja' si nació de un SMS
    // del banco o de algo compartido a la app.
    origen: datos.origen === 'bandeja' ? 'bandeja' : 'manual',
    creadoPor: quien(usuario),
    creadoEl: el,
    anulacion: null,
    historial: [
      {
        tipo: 'creado',
        texto: porPagar
          ? 'Lo anotó como pendiente por pagar'
          : `Registró ${tipo === 'ingreso' ? 'el ingreso' : 'el gasto'} · ${fraseDelMonto(eur, original)}`,
        por: quien(usuario),
        el,
      },
    ],
  }

  await guardar(CLAVE(mov.id), mov)
  await empujarAIndice(INDICE, mov.id)
  return mov
}

// Se guarda el `pathname`, no una URL: el store de Blob es privado y los
// enlaces se firman al servir, no al guardar. Solo se aceptan rutas con la
// forma que genera /api/subir.
function normalizarAdjuntos(lista, tipo, usuario, el) {
  if (!Array.isArray(lista)) return []
  return lista
    .filter((a) => a && typeof a.pathname === 'string' && RUTA_VALIDA.test(a.pathname))
    .slice(0, 8)
    .map((a) => ({
      tipo,
      pathname: a.pathname,
      nombre: texto(a.nombre, 120) || 'adjunto',
      contentType: texto(a.contentType, 80) || null,
      subidoPor: quien(usuario),
      subidoEl: el,
    }))
}

// ── acciones ────────────────────────────────────────────────────────────────

// Pagar un "por pagar". Quien paga declara en qué moneda MOVIÓ el dinero, que
// no tiene por qué ser aquella en que se anotó: el alquiler anotado en euros
// se puede acabar pagando en bolívares.
export async function pagar(usuario, id, datos) {
  if (!puedeEscribir(usuario)) throw new ErrorMovimiento('Tu acceso es de solo lectura', 403)
  const t = await leer(id)
  if (t.estado === 'registrado') throw new ErrorMovimiento('Ese movimiento ya está registrado')
  if (t.estado === 'anulado') throw new ErrorMovimiento('Ese movimiento está anulado: hay que reactivarlo antes')

  const el = ahora()
  const { eur, original } = await enEuros(datos.monto, datos.moneda)
  if (eur == null) throw new ErrorMovimiento('Falta cuánto se pagó')

  t.estado = 'registrado'
  t.montoEur = eur
  t.original = original
  t.fecha = dia(datos.fecha) ?? diaCaracas()
  t.cuenta = (await validarCuenta(datos.cuenta)) ?? t.cuenta
  t.adjuntos = [...t.adjuntos, ...normalizarAdjuntos(datos.adjuntos, 'recibo', usuario, el)]
  t.historial.push({ tipo: 'pagado', texto: `Lo pagó · ${fraseDelMonto(eur, original)}`, por: quien(usuario), el })

  await guardar(CLAVE(t.id), t)
  return t
}

// Deshacer el pago: vuelve a la lista de por pagar. El monto se queda como
// estimado —es lo último que se supo— y el historial cuenta el viaje entero.
export async function deshacerPago(usuario, id) {
  if (!puedeEscribir(usuario)) throw new ErrorMovimiento('Tu acceso es de solo lectura', 403)
  const t = await leer(id)
  if (t.estado !== 'registrado') throw new ErrorMovimiento('Ese movimiento no está registrado')
  const fuePendiente = t.historial.some((h) => h.tipo === 'pagado')
  if (!fuePendiente) throw new ErrorMovimiento('Ese movimiento no nació como pendiente: si está mal, edítalo o anúlalo')

  const el = ahora()
  t.estado = 'porPagar'
  t.fecha = null
  t.historial.push({ tipo: 'reabierto', texto: 'Deshizo el pago y volvió a dejarlo pendiente', por: quien(usuario), el })

  await guardar(CLAVE(t.id), t)
  return t
}

// ── editar ──────────────────────────────────────────────────────────────────

// CORREGIR LO QUE SE ESCRIBIÓ MAL, sin partir la historia en dos. La categoría
// de un movimiento ES la categoría de la gráfica del mes: si dice "Mercado" y
// era "Restaurantes", el resumen miente hasta que alguien lo corrija.
//
// Lo que cambia se escribe en el historial campo por campo y con los dos
// valores, el viejo y el nuevo.
const EDITABLES = ['titulo', 'categoria', 'cuenta', 'descripcion', 'fecha', 'paraCuando', 'monto']

export async function editar(usuario, id, datos) {
  if (!puedeEscribir(usuario)) throw new ErrorMovimiento('Tu acceso es de solo lectura', 403)
  const t = await leer(id)

  // Solo se toca lo que venga en el cuerpo: mandar tres campos no puede
  // borrar los otros tres. `undefined` significa "no lo estoy cambiando".
  const pedido = {}
  for (const campo of EDITABLES) {
    if (Object.hasOwn(datos ?? {}, campo) && datos[campo] !== undefined) pedido[campo] = datos[campo]
  }

  const cambios = []
  const el = ahora()

  if (Object.hasOwn(pedido, 'titulo')) {
    const titulo = texto(pedido.titulo, 120)
    if (!titulo) throw new ErrorMovimiento('El movimiento necesita un título')
    if (titulo !== t.titulo) {
      cambios.push(`título: "${t.titulo}" → "${titulo}"`)
      t.titulo = titulo
    }
  }

  if (Object.hasOwn(pedido, 'categoria')) {
    const idCat = validarCategoria(pedido.categoria, t.tipo)
    if (idCat !== t.categoria) {
      cambios.push(`de qué es: ${etiquetaCategoria(t.categoria)} → ${etiquetaCategoria(idCat)}`)
      t.categoria = idCat
    }
  }

  if (Object.hasOwn(pedido, 'cuenta')) {
    const cuenta = await validarCuenta(pedido.cuenta)
    if (cuenta !== (t.cuenta ?? null)) {
      cambios.push(cuenta ? 'cambió la cuenta' : 'quitó la cuenta')
      t.cuenta = cuenta
    }
  }

  if (Object.hasOwn(pedido, 'descripcion')) {
    const d = texto(pedido.descripcion, 2000)
    if (d !== (t.descripcion ?? '')) {
      cambios.push(d ? 'cambió el detalle' : 'borró el detalle')
      t.descripcion = d
    }
  }

  if (Object.hasOwn(pedido, 'fecha') && t.estado === 'registrado') {
    const f = dia(pedido.fecha)
    if (f && f !== t.fecha) {
      cambios.push(`fecha: ${t.fecha ?? '—'} → ${f}`)
      t.fecha = f
    }
  }

  if (Object.hasOwn(pedido, 'paraCuando') && t.estado === 'porPagar') {
    const p = dia(pedido.paraCuando)
    if (p !== (t.paraCuando ?? null)) {
      cambios.push(p ? `para cuándo: ${t.paraCuando ?? '—'} → ${p}` : 'quitó el "para cuándo"')
      t.paraCuando = p
    }
  }

  if (Object.hasOwn(pedido, 'monto')) {
    // Se vuelve a convertir con la tasa de HOY, no con la del día en que se
    // creó: la cifra es nueva, así que su tasa también lo es. La moneda se
    // lee de `datos` porque no es un campo del movimiento sino cómo leer la
    // cifra que llega.
    const nuevo = await enEuros(pedido.monto, datos.moneda)
    if (t.estado === 'registrado' && nuevo.eur == null) throw new ErrorMovimiento('Falta cuánto fue')
    const monedaAntes = t.original?.moneda ?? 'eur'
    const monedaAhora = nuevo.original?.moneda ?? 'eur'
    if (nuevo.eur !== t.montoEur || monedaAhora !== monedaAntes) {
      const antes = t.montoEur == null ? 'sin monto' : `${cifra.format(t.montoEur)} €`
      const despues = nuevo.eur == null ? 'sin monto' : `${cifra.format(nuevo.eur)} €`
      const enQue = monedaAhora !== monedaAntes ? ` (ahora en ${NOMBRE_MONEDA[monedaAhora]})` : ''
      cambios.push(`monto: ${antes} → ${despues}${enQue}`)
      t.montoEur = nuevo.eur
      t.original = nuevo.original
    }
  }

  // Guardar sin cambios no deja línea en el historial: abrir el formulario y
  // cerrarlo no es un hecho que merezca contarse.
  if (!cambios.length) return t

  t.historial.push({ tipo: 'editado', texto: `Corrigió el movimiento · ${cambios.join(' · ')}`, por: quien(usuario), el })

  await guardar(CLAVE(t.id), t)
  return t
}

const etiquetaCategoria = (id) => CATEGORIA_POR_ID[id]?.label ?? (id ? String(id) : 'sin categoría')

// ── anular / reactivar ──────────────────────────────────────────────────────

export async function anular(usuario, id, datos) {
  if (!puedeEscribir(usuario)) throw new ErrorMovimiento('Tu acceso es de solo lectura', 403)
  const t = await leer(id)
  if (t.estado === 'anulado') throw new ErrorMovimiento('Ese movimiento ya está anulado')
  const motivo = texto(datos.motivo, 500)
  if (!motivo) throw new ErrorMovimiento('Hay que decir por qué se anula')

  const el = ahora()
  // Para poder volver exactamente a donde estaba si fue un error anularlo.
  t.estadoPrevio = t.estado
  t.estado = 'anulado'
  t.anulacion = { motivo, por: quien(usuario), el }
  t.historial.push({ tipo: 'anulado', texto: motivo, por: quien(usuario), el })

  await guardar(CLAVE(t.id), t)
  return t
}

export async function reactivar(usuario, id) {
  if (!puedeEscribir(usuario)) throw new ErrorMovimiento('Tu acceso es de solo lectura', 403)
  const t = await leer(id)
  if (t.estado !== 'anulado') throw new ErrorMovimiento('Ese movimiento no está anulado')

  const el = ahora()
  t.estado = t.estadoPrevio ?? 'registrado'
  delete t.estadoPrevio
  t.anulacion = null
  t.historial.push({ tipo: 'reactivado', texto: 'Lo reactivó', por: quien(usuario), el })

  await guardar(CLAVE(t.id), t)
  return t
}

// ── comentar ────────────────────────────────────────────────────────────────

export async function comentar(usuario, id, datos) {
  if (!puedeEscribir(usuario)) throw new ErrorMovimiento('Tu acceso es de solo lectura', 403)
  const t = await leer(id)
  const nota = texto(datos.texto, 1000)
  const el = ahora()
  const adjuntos = normalizarAdjuntos(datos.adjuntos, 'recibo', usuario, el)
  if (!nota && !adjuntos.length) throw new ErrorMovimiento('El comentario está vacío')

  t.adjuntos = [...t.adjuntos, ...adjuntos]
  t.historial.push({
    tipo: 'comentario',
    texto: nota || (adjuntos.length === 1 ? 'Adjuntó un archivo' : `Adjuntó ${adjuntos.length} archivos`),
    por: quien(usuario),
    el,
  })

  await guardar(CLAVE(t.id), t)
  return t
}
