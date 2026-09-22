import { obtener, guardar } from './store.js'

// LA TASA DEL DÍA.
//
// La contabilidad se lleva en dólares, pero casi todo se paga en bolívares:
// quien va a la ferretería vuelve con una cifra en Bs y hasta ahora tenía que
// abrir la calculadora, buscar la tasa y teclear el resultado. Con eso el
// número dependía de qué tasa mirara cada quien y de si se equivocó dividiendo.
//
// Ahora la tasa la trae el servidor una vez al día, del BCV, y queda escrita
// dentro del ticket que se creó con ella. Seis meses después se puede
// responder no solo "cuánto fue" sino "a cuánto estaba el dólar ese día".
//
// TRES CAPAS, en este orden:
//
//   1. corrección a mano   quien administra la escribió hoy; manda sobre todo
//   2. BCV del día         lo que devolvió la API hoy
//   3. lo último que hubo  si la API se cayó, mejor la tasa de ayer marcada
//                          como vieja que ninguna
//
// La corrección a mano vale solo para su día. Al día siguiente vuelve sola al
// BCV: si no, un ajuste puntual se quedaría pegado para siempre.

// Una clave por moneda. Las de antes —`tasa:bcv` y `tasa:manual`, sin sufijo—
// quedan huérfanas en Redis y no las lee nadie: son el caché de un día, así
// que perderlas cuesta una petición a la API, no un dato.
const CLAVE_BCV = (moneda) => `tasa:bcv:${moneda}`
const CLAVE_MANUAL = (moneda) => `tasa:manual:${moneda}`

// Venezuela es UTC−4 todo el año, sin horario de verano. El día de la tasa es
// el de Caracas, no el del servidor de Vercel, que corre en UTC: a las 21:00
// de Caracas allá ya es mañana y la tasa se habría dado por vencida antes de
// tiempo.
export function diaCaracas(d = new Date()) {
  return new Date(d.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// UNA fuente, y hay que decirlo en voz alta porque aquí llegó a haber dos.
//
// La segunda era pydolarve.org. El 31/08/2026 se comprobó que su API responde
// 404 y que el dominio está aparcado en un servicio de venta. Eso no es una
// fuente caída: es una fuente que cualquiera puede comprar mañana y hacer que
// devuelva el JSON que le convenga. Y esta rama lo habría aceptado como la
// tasa oficial del BCV, porque `tasaValida` solo mira que sea un número finito
// y positivo, no de dónde salió. Con {"price": 1} en la mano, el dueño nuevo
// decidiría a cuánto se convierten los pagos de la familia.
//
// Un respaldo que no controlamos es peor que no tener respaldo, así que se
// quita. El respaldo de verdad es el de siempre y está más abajo: si esta
// fuente no responde, se usa la última tasa conocida y se marca `vieja` en
// pantalla, que es honesto y no depende de nadie.
//
// Si algún día hace falta redundancia real, se añade aquí otra fuente que
// alguien haya probado ESE día. La lista sigue siendo una lista justamente
// para eso; lo que no puede volver a pasar es heredar una URL de memoria.
//
// Una lista POR MONEDA. El BCV publica el dólar y el euro por separado, cada
// uno en bolívares —nunca uno contra el otro—, así que aquí son dos cosas
// independientes que se piden y se guardan aparte. Que el euro falte hoy no
// dice nada sobre el dólar.
const FUENTES = {
  usd: [
    {
      nombre: 've.dolarapi.com',
      url: 'https://ve.dolarapi.com/v1/dolares/oficial',
      leer: (j) => j?.promedio ?? j?.venta ?? j?.compra,
    },
  ],
  eur: [
    {
      nombre: 've.dolarapi.com',
      url: 'https://ve.dolarapi.com/v1/euros/oficial',
      leer: (j) => j?.promedio ?? j?.venta ?? j?.compra,
    },
  ],
}

export const MONEDAS = Object.keys(FUENTES)

// Un número que no pasa por aquí no se guarda. El BCV ha estado en 1, en 36 y
// en cientos; el rango es ancho a propósito, solo descarta lo imposible: un
// cero, un texto, o una respuesta que cambió de formato y trae otra cosa.
function tasaValida(v) {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 && n < 100_000_000 ? Math.round(n * 10000) / 10000 : null
}

async function traerDelBcv(moneda) {
  for (const f of FUENTES[moneda] ?? []) {
    try {
      // Sin timeout la función de Vercel se quedaría esperando hasta agotarse
      // y la vista de tickets no cargaría por culpa de un servicio ajeno.
      const r = await fetch(f.url, { signal: AbortSignal.timeout(6000) })
      if (!r.ok) continue
      const bs = tasaValida(f.leer(await r.json()))
      if (bs) return { bs, fuente: f.nombre }
    } catch {
      // Da igual por qué falló: se prueba la siguiente y, si no hay más, se
      // sigue con la última tasa guardada.
    }
  }
  return null
}

// El estado con el que trabaja el resto de la app, para UNA moneda.
//
//   { moneda, bs, dia, fuente, actualizadaEl, origen: 'bcv'|'manual', vieja }
//
// `bs` es siempre cuántos bolívares vale UNA unidad de esa moneda, que es como
// el BCV publica las dos.
//
// `vieja` significa "esto no es de hoy": la app la sigue usando, porque una
// tasa de ayer convierte mucho mejor que ninguna, pero lo dice en pantalla
// para que nadie firme un pago creyendo que el número está fresco. Va por
// moneda: el euro puede estar rancio mientras el dólar está al día.
export async function tasaActual(moneda = 'usd') {
  if (!FUENTES[moneda]) return null
  const hoy = diaCaracas()
  const con = (t, origen, vieja) => ({ ...t, moneda, origen, vieja })

  const manual = await leerSeguro(CLAVE_MANUAL(moneda))
  if (manual?.dia === hoy && tasaValida(manual.bs)) return con(manual, 'manual', false)

  const guardada = await leerSeguro(CLAVE_BCV(moneda))
  if (guardada?.dia === hoy && tasaValida(guardada.bs)) return con(guardada, 'bcv', false)

  const fresca = await traerDelBcv(moneda)
  if (fresca) {
    const nueva = { bs: fresca.bs, dia: hoy, fuente: fresca.fuente, actualizadaEl: new Date().toISOString() }
    await guardarSeguro(CLAVE_BCV(moneda), nueva)
    return con(nueva, 'bcv', false)
  }

  // No hubo forma de actualizarla. Lo último que se supo, dicho como lo que
  // es. Y si nunca hubo nada, null: la app funciona igual, solo que sin poder
  // convertir esa moneda hasta que alguien escriba la tasa a mano.
  if (guardada && tasaValida(guardada.bs)) return con(guardada, 'bcv', true)
  if (manual && tasaValida(manual.bs)) return con(manual, 'manual', true)
  return null
}

// Las dos de golpe, que es como las pide la pantalla: `{ usd, eur }`, cada una
// con su estado propio o null. En paralelo porque son dos peticiones a un
// servicio ajeno y encadenarlas dolería el día que responda lento.
export async function tasasActuales() {
  const pares = await Promise.all(MONEDAS.map(async (m) => [m, await tasaActual(m)]))
  return Object.fromEntries(pares)
}

// La tasa no puede tumbar nada. Si el almacén no está configurado o falla, se
// pierde el caché y se vuelve a consultar la API: peor rendimiento, misma
// respuesta.
async function leerSeguro(clave) {
  try {
    return await obtener(clave)
  } catch {
    return null
  }
}

async function guardarSeguro(clave, valor) {
  try {
    await guardar(clave, valor)
  } catch {
    /* se queda sin caché, no sin tasa */
  }
}

// Corregirla a mano. Es para el día en que el BCV publica tarde, o en que la
// familia acordó pagar a otra tasa: se escribe, queda con nombre y hora, y
// mañana vuelve sola al automático.
//
// Se corrige una moneda cada vez. La pantalla hoy solo ofrece corregir el
// dólar, que es donde pasa: el euro se usa de vez en cuando y no ha hecho
// falta tocarlo nunca. Pero la función ya acepta cuál, así que el día que
// haga falta es añadir un botón, no rehacer esto.
export async function fijarManual(usuario, valor, moneda = 'usd') {
  if (!FUENTES[moneda]) return null
  const bs = tasaValida(valor)
  if (!bs) return null
  const nueva = {
    bs,
    dia: diaCaracas(),
    fuente: `a mano · ${usuario.nombre}`,
    actualizadaEl: new Date().toISOString(),
    por: { id: usuario.id, nombre: usuario.nombre },
  }
  await guardar(CLAVE_MANUAL(moneda), nueva)
  return { ...nueva, moneda, origen: 'manual', vieja: false }
}

// Deshacer la corrección y volver al BCV, sin esperar a mañana.
export async function volverAutomatica(moneda = 'usd') {
  if (!FUENTES[moneda]) return null
  await guardarSeguro(CLAVE_MANUAL(moneda), null)
  return tasaActual(moneda)
}
