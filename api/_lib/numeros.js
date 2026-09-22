// Leer un número que tecleó una persona.
//
// Vive aparte del resto porque lo usan tres sitios: los montos del gasto, la
// tasa del día y —importado tal cual por Vite— el formulario en el navegador,
// que tiene que previsualizar la conversión con exactamente las mismas reglas
// que el servidor va a aplicar. Si aquí y allá se leyera distinto, la pantalla
// diría un número y se guardaría otro.
//
// Por eso este archivo no importa nada: ni de Node ni del resto de la app.

// Los montos se escriben a la europea/venezolana: "2.147,80" es dos mil ciento
// cuarenta y siete con ochenta. Pero también va a llegar "240.50" de quien
// tenga el teclado en inglés, y "240" a secas. Los tres tienen que caer bien.
//
// La regla: el último separador que aparece es el decimal, y el otro es de
// miles. Cuando solo hay puntos, "1.234" con exactamente tres cifras detrás se
// lee como mil doscientos treinta y cuatro, no como uno coma dos.
//
// Vacío es válido y significa "todavía no se sabe cuánto": un pago por hacer
// muchas veces se anota antes de tener la cifra, y obligar a inventarla haría
// que el total de lo pendiente mienta.
export function monto(v) {
  if (v == null || v === '') return null

  let s = String(v).trim().replace(/[^\d,.-]/g, '')
  if (!s || !/\d/.test(s)) return null

  const ultimaComa = s.lastIndexOf(',')
  const ultimoPunto = s.lastIndexOf('.')

  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    // Los dos presentes: manda el que va más a la derecha.
    const decimal = ultimaComa > ultimoPunto ? ',' : '.'
    const miles = decimal === ',' ? '.' : ','
    s = s.split(miles).join('').replace(decimal, '.')
  } else if (ultimaComa >= 0) {
    // Solo comas. En español la coma es el decimal.
    s = s.replace(/,/g, '.')
  } else if (ultimoPunto >= 0) {
    // Solo puntos. Tres cifras detrás y sin más puntos = separador de miles.
    const trozos = s.split('.')
    const ultimo = trozos[trozos.length - 1]
    if (trozos.length > 2 || (trozos.length === 2 && ultimo.length === 3 && trozos[0] !== '')) {
      s = trozos.join('')
    }
  }

  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

// Dos decimales, que es como se guarda todo el dinero de la app.
export const centavos = (n) => Math.round(n * 100) / 100

// LA CONVERSIÓN, en un solo sitio para que servidor y navegador no discrepen
// ni en el último céntimo.
//
// La contabilidad de Uzko se lleva en EUROS: es la moneda en la que se decide
// y la que suman los totales y el presupuesto. Pero los pagos llegan en tres
// monedas —euros, dólares y bolívares— así que todo se convierte al entrar.
//
// Las tasas vienen del BCV, que publica el dólar y el euro POR SEPARADO,
// cada uno en bolívares, nunca uno contra el otro:
//
//   `tasaEur` = cuántos bolívares vale un euro.
//   `tasaUsd` = cuántos bolívares vale un dólar.
//
// El cambio dólar→euro sale de cruzar esas dos cifras del mismo día y la misma
// fuente, no de una cotización de mercado: así el número guardado se puede
// comprobar seis meses después contra lo que el BCV publicó ese día.
//
// Una multiplicación y una división, no dos pasos por bolívares: pasar por un
// importe intermedio redondeado arrastra el error hasta el resultado.
export function bsAEuros(bs, tasaEur) {
  if (bs == null || !tasaEur) return null
  return centavos(bs / tasaEur)
}

export function eurosABs(eur, tasaEur) {
  if (eur == null || !tasaEur) return null
  return centavos(eur * tasaEur)
}

export function usdAEuros(usd, tasaUsd, tasaEur) {
  if (usd == null || !tasaUsd || !tasaEur) return null
  return centavos((usd * tasaUsd) / tasaEur)
}

export function eurosAUsd(eur, tasaEur, tasaUsd) {
  if (eur == null || !tasaEur || !tasaUsd) return null
  return centavos((eur * tasaEur) / tasaUsd)
}
