import { MONEDA } from '../config'

// Todo el dinero principal de la app es EUR y se formatea aquí, en un solo
// sitio, para que "23,50 €" se escriba igual en el KPI, la tabla y el tooltip.
const eurFmt = new Intl.NumberFormat(MONEDA.locale, {
  style: 'currency',
  currency: MONEDA.code,
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function dinero(valor) {
  return eurFmt.format(valor || 0)
}

const eurEnteroFmt = new Intl.NumberFormat(MONEDA.locale, {
  style: 'currency',
  currency: MONEDA.code,
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

// Igual que `dinero` pero sin céntimos. Para KPIs y ejes, donde los céntimos
// solo hacen ruido.
export function dineroEntero(valor) {
  return eurEnteroFmt.format(valor || 0)
}

const numFmt = new Intl.NumberFormat(MONEDA.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Las monedas secundarias: en qué se pagó de verdad. Nunca son la cifra
// principal —esa es siempre el euro— sino la que explica de dónde salió.
export function bolivares(valor) {
  if (valor == null) return '—'
  return `Bs ${numFmt.format(valor)}`
}

export function dolares(valor) {
  if (valor == null) return '—'
  return `$ ${numFmt.format(valor)}`
}

// El monto original de un movimiento, en la moneda en que se tecleó.
export function montoOriginal(original) {
  if (!original) return null
  if (original.moneda === 'bs') return bolivares(original.valor)
  if (original.moneda === 'usd') return dolares(original.valor)
  return null
}

// Abreviado para los ejes de las gráficas: 3,4k € en vez de 3.358,89 €.
export function dineroCorto(valor) {
  const n = Number(valor) || 0
  const abs = Math.abs(n)
  if (abs >= 1000) {
    const k = n / 1000
    // Sin decimal a partir de 10k: "12k €" es más legible que "12,3k €".
    return `${k.toLocaleString(MONEDA.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: abs >= 10000 ? 0 : 1,
    })}k €`
  }
  return eurEnteroFmt.format(n)
}

const porcentajeFmt = new Intl.NumberFormat(MONEDA.locale, {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

export function porcentaje(fraccion) {
  if (!Number.isFinite(fraccion)) return '—'
  return porcentajeFmt.format(fraccion)
}

// Variación entre dos meses, ya con signo: "+18,4 %" / "−6 %".
// Cuando el mes anterior fue 0 no hay porcentaje que calcular y se devuelve
// null: quien llama muestra un guion.
export function variacion(actual, anterior) {
  if (!anterior) return null
  const cambio = (actual - anterior) / anterior
  const signo = cambio > 0 ? '+' : cambio < 0 ? '−' : ''
  return { cambio, texto: `${signo}${porcentajeFmt.format(Math.abs(cambio))}` }
}

const fechaFmt = new Intl.DateTimeFormat(MONEDA.locale, {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

// Una fecha SIN hora ("2026-09-22", que es como se guarda `fecha`) el motor
// la interpreta como medianoche UTC, y al oeste de Greenwich eso cae el día
// anterior. Se ancla al mediodía local, la única hora que ningún huso mueve
// de día. Las marcas de tiempo completas (`creadoEl`) ya traen su zona.
const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/

export function fechaLarga(iso) {
  if (!iso) return ''
  const d = new Date(SOLO_DIA.test(iso) ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return ''
  return fechaFmt.format(d)
}

// El día en que cayó una marca de tiempo, EN LA ZONA DE QUIEN MIRA.
// `creadoEl.slice(0, 10)` sería más corto y estaría mal: es el día en UTC.
export function diaDe(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const diaCortoFmt = new Intl.DateTimeFormat(MONEDA.locale, { day: 'numeric', month: 'short' })

// Una fecha corta para las filas de la lista, donde compite con el título y
// el monto: "22 sept". Larga en el detalle, donde hay sitio.
export function diaCorto(valor) {
  const v = String(valor ?? '').trim()
  if (!v || !SOLO_DIA.test(v)) return v
  const d = new Date(`${v}T12:00:00`)
  return Number.isNaN(d.getTime()) ? v : diaCortoFmt.format(d)
}

const fechaCortaFmt = new Intl.DateTimeFormat(MONEDA.locale, {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function fechaHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return fechaCortaFmt.format(d)
}

// "hace 3 días". En la bandeja importa más cuánto lleva esperando que la
// fecha exacta.
export function desde(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const seg = Math.round((Date.now() - t) / 1000)
  if (seg < 60) return 'recién'
  const min = Math.round(seg / 60)
  if (min < 60) return `hace ${min} min`
  const hor = Math.round(min / 60)
  if (hor < 24) return `hace ${hor} h`
  const dias = Math.round(hor / 24)
  if (dias === 1) return 'ayer'
  if (dias < 31) return `hace ${dias} días`
  const meses = Math.round(dias / 30)
  return meses === 1 ? 'hace un mes' : `hace ${meses} meses`
}

// La tasa lleva más decimales que el dinero: el BCV publica cuatro, y en un
// pago de seis cifras en bolívares redondear a dos ya mueve el resultado.
const tasaFmt = new Intl.NumberFormat(MONEDA.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
})

export function tasaDia(bs) {
  if (bs == null) return '—'
  return `Bs ${tasaFmt.format(bs)}`
}

// Un número puesto dentro de un input para que alguien lo corrija: "196815.6"
// se lee fatal cuando lo que se espera es "196.815,60". Sale ya formateado,
// que es como se va a volver a leer al guardarlo.
export function paraTeclear(valor) {
  if (valor == null) return ''
  return numFmt.format(valor)
}
