// LEER EL MENSAJE DEL BANCO.
//
// Cuando Valeria paga con la tarjeta, el banco le manda un SMS o una
// notificación: "Compra aprobada por EUR 23,50 en MERCADONA VALENCIA el
// 22/09". Ese texto llega aquí por dos caminos —el webhook /api/inbox (un
// automatizador del teléfono lo reenvía solo) y el "Compartir a Uzko" del
// sistema— y de él hay que sacar lo que el formulario necesita: cuánto, en
// qué moneda, dónde y cuándo.
//
// Este archivo no importa nada A PROPÓSITO: lo usa el servidor al recibir el
// webhook y lo importa Vite tal cual para que el navegador parsee lo
// compartido con exactamente las mismas reglas. Si aquí y allá se leyera
// distinto, el mismo SMS daría dos gastos distintos.
//
// El parser es deliberadamente conservador: lo que no entiende lo deja vacío
// y la persona lo completa al confirmar. Un campo en blanco se rellena en dos
// segundos; un monto mal leído que nadie revisa es un mes que miente.

// ── la moneda y el monto ────────────────────────────────────────────────────

// Cada patrón captura la cifra pegada a una marca de moneda, antes o después.
// El orden importa: "Bs" se busca antes que "$" porque hay bancos que
// escriben "Bs. 1.250,00" y otros "VES 1250.00"; y "US$" antes que "$" a
// secas. La cifra se captura TAL CUAL se escribió —"1.250,00"— y la lee
// `monto()` en numeros.js, que ya sabe de comas y puntos.
const CIFRA = '(\\d{1,3}(?:[.,\\s]\\d{3})*(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)'

const PATRONES_MONTO = [
  { moneda: 'bs', re: new RegExp(`(?:bs\\.?s?|ves|bolivares?)[\\s:]*${CIFRA}`, 'i') },
  { moneda: 'bs', re: new RegExp(`${CIFRA}\\s*(?:bs\\.?s?|ves|bolivares?)(?![a-z])`, 'i') },
  { moneda: 'eur', re: new RegExp(`(?:€|eur(?:os?)?)[\\s:]*${CIFRA}`, 'i') },
  { moneda: 'eur', re: new RegExp(`${CIFRA}\\s*(?:€|eur(?:os?)?)(?![a-z])`, 'i') },
  { moneda: 'usd', re: new RegExp(`(?:us\\$|usd|\\$|dolares?)[\\s:]*${CIFRA}`, 'i') },
  { moneda: 'usd', re: new RegExp(`${CIFRA}\\s*(?:us\\$|usd|dolares?)(?![a-z])`, 'i') },
]

// ── el comercio ─────────────────────────────────────────────────────────────

// Casi todos los bancos dicen el comercio después de "en": "…por 23,50 EUR en
// MERCADONA VALENCIA el 22/09/26…". Se corta en lo que claramente ya no es el
// nombre: una fecha, una hora, "el día", "con su tarjeta", el final de línea.
const RE_COMERCIO = /\ben\s+([A-ZÁÉÍÓÚÑ0-9][\w\sÁÉÍÓÚÑáéíóúñ.,*'&-]{1,50}?)(?=\s+(?:el|del|dia|día|con|desde|a\s+las|por)\b|\s*\d{1,2}[/.-]\d{1,2}|\s*\d{1,2}:\d{2}|[.;\n]|$)/

// ── la fecha ────────────────────────────────────────────────────────────────

// dd/mm/aa o dd-mm-aaaa. Día y mes en orden europeo/venezolano, que es como
// escriben los bancos de los dos lados. Sin fecha, quien confirma decide.
const RE_FECHA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/

// ── ¿entró o salió? ─────────────────────────────────────────────────────────

const RE_INGRESO = /\b(abono|deposito|depósito|recibiste|recibido|te (envio|envió|transfirio|transfirió)|pago recibido|transferencia recibida|nomina|nómina)\b/i

// Devuelve lo que se pudo leer, cada campo por separado y ninguno inventado:
//
//   { monto: '23,50'|null, moneda: 'eur'|'usd'|'bs'|null,
//     comercio: 'MERCADONA VALENCIA'|'', fecha: '2026-09-22'|null,
//     tipo: 'gasto'|'ingreso' }
//
// `monto` es un string tal cual venía, listo para caer en el mismo campo del
// formulario donde se teclearía a mano.
export function parsearMensaje(texto) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return { monto: null, moneda: null, comercio: '', fecha: null, tipo: 'gasto' }

  let monto = null
  let moneda = null
  for (const p of PATRONES_MONTO) {
    const m = t.match(p.re)
    if (m) {
      monto = m[1]
      moneda = p.moneda
      break
    }
  }

  const c = t.match(RE_COMERCIO)
  const comercio = c ? c[1].trim().replace(/[.,;]+$/, '') : ''

  let fecha = null
  const f = t.match(RE_FECHA)
  if (f) {
    const dd = Number(f[1])
    const mm = Number(f[2])
    let aaaa = Number(f[3])
    if (aaaa < 100) aaaa += 2000
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && aaaa >= 2020 && aaaa <= 2100) {
      const candidata = `${aaaa}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
      // La misma verificación anti-desborde que el resto de la app: el 31/02
      // no existe y `new Date` lo convertiría callado en marzo.
      const d = new Date(`${candidata}T12:00:00`)
      const vuelta = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (vuelta === candidata) fecha = candidata
    }
  }

  return { monto, moneda, comercio, fecha, tipo: RE_INGRESO.test(t) ? 'ingreso' : 'gasto' }
}
