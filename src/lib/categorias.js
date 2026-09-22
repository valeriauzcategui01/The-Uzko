// Las categorías de los gastos de Valeria, y las reglas que clasifican solas.
//
// UNA SOLA LISTA para los tres que la necesitan: el formulario para ofrecerla,
// el servidor para validar lo que llega (la importa vía api/_lib), y el
// clasificador automático de la bandeja de entrada, que al leer el SMS del
// banco propone en qué categoría cae "MERCADONA" o "NETFLIX.COM". Si hubiera
// dos listas, el formulario ofrecería una categoría que el servidor rechaza.
//
// Los colores están escogidos para que la dona del resumen se lea de un
// vistazo: parientes de gasto (mercado/restaurantes, servicios/suscripciones)
// comparten familia de color sin confundirse.

export const CATEGORIAS = [
  { id: 'vivienda', label: 'Vivienda y alquiler', color: '#4f46e5' },
  { id: 'servicios', label: 'Servicios y facturas', color: '#0ea5e9' },
  { id: 'mercado', label: 'Mercado', color: '#10b981' },
  { id: 'restaurantes', label: 'Restaurantes y café', color: '#047857' },
  { id: 'transporte', label: 'Transporte', color: '#7c3aed' },
  { id: 'salud', label: 'Salud', color: '#ef4444' },
  { id: 'belleza', label: 'Belleza y cuidado personal', color: '#f472b6' },
  { id: 'ropa', label: 'Ropa y compras', color: '#e11d48' },
  { id: 'suscripciones', label: 'Suscripciones', color: '#6366f1' },
  { id: 'entretenimiento', label: 'Entretenimiento', color: '#f59e0b' },
  { id: 'viajes', label: 'Viajes', color: '#2563eb' },
  { id: 'educacion', label: 'Educación', color: '#0891b2' },
  { id: 'mascotas', label: 'Mascotas', color: '#d946ef' },
  { id: 'regalos', label: 'Regalos y detalles', color: '#ca8a04' },
  { id: 'deudas', label: 'Deudas y tarjetas', color: '#9f1239' },
  { id: 'ahorro', label: 'Ahorro e inversión', color: '#14b8a6' },
  { id: 'otros', label: 'Otros', color: '#94a3b8' },
  // Las de ingreso van al final y marcadas: el selector las ofrece solo cuando
  // se registra un ingreso, y las gráficas de gasto las excluyen.
  { id: 'sueldo', label: 'Sueldo', color: '#16a34a', ingreso: true },
  { id: 'otros-ingresos', label: 'Otros ingresos', color: '#65a30d', ingreso: true },
]

export const CATEGORIA_POR_ID = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c]))

// Las que se ofrecen según lo que se está registrando. La misma pareja de
// listas la usan el desplegable Y la validación del servidor.
export const CATEGORIAS_GASTO = CATEGORIAS.filter((c) => !c.ingreso)
export const CATEGORIAS_INGRESO = CATEGORIAS.filter((c) => c.ingreso)

// Cada regla es [categoría, expresión]. Se evalúan en orden sobre el texto
// normalizado (minúsculas, sin acentos), y gana la primera que haga match.
// Las específicas van primero: "FARMACIA DEL MERCADO" es salud, no mercado.
//
// Vienen de los comercios que un SMS o una notificación de banco suele traer:
// cadenas de España y Venezuela, apps y servicios globales. Cuando nada hace
// match el gasto cae en "Otros", que el resumen muestra tal cual para que se
// vea qué falta por clasificar en vez de esconderlo.
const REGLAS = [
  ['suscripciones', /netflix|spotify|hbo|disney|prime video|apple\.com|icloud|google (one|storage)|youtube|chatgpt|openai|canva|dropbox|office ?365|microsoft 365|simple ?tv|directv/],
  ['salud', /farmacia|farmatodo|clinica|medico|dentista|odontolog|laboratorio|optica|seguro medico|locatel/],
  ['belleza', /peluqueria|salon de belleza|barberia|manicur|spa\b|cosmetic|sephora|druni|primor/],
  ['transporte', /\buber\b|cabify|bolt\b|didi|taxi|metro|gasolina|gasoil|repsol|cepsa|shell|texaco|estacionamiento|parking|peaje|renfe|emt\b/],
  ['viajes', /vuelo|aerolinea|ryanair|vueling|iberia|laser|conviasa|avior|booking|airbnb|\bhotel|hostal|posada|equipaje|despegar/],
  ['mercado', /mercadona|carrefour|\blidl\b|\baldi\b|\bdia\b|supermercado|automercado|excelsior gama|plazas|central madeirense|bodegon|fruteria|carniceria|charcuteria|panaderia|hiperlider|makro|consum|eroski|alcampo/],
  ['restaurantes', /restaurante|mcdonald|burger|kfc|starbucks|cafeteria|\bcafe\b|pizz|sushi|arepera|tasca|bar\b|glovo|uber ?eats|just ?eat|pedidosya|yummy|heladeria/],
  ['ropa', /\bzara\b|shein|bershka|pull ?& ?bear|stradivarius|primark|mango\b|h ?& ?m|\bnike\b|adidas|decathlon|zapateria|amazon|aliexpress|el corte ingles|traki/],
  ['servicios', /iberdrola|endesa|naturgy|corpoelec|luz\b|electricidad|hidrocapital|hidrocentro|\bagua\b|movistar|vodafone|orange|\bdigi\b|digitel|cantv|internet|\baba\b|netuno|fibex|inter\b|telefono|gas\b|bombona|condominio|aseo/],
  ['vivienda', /alquiler|arriendo|hipoteca|inmobiliaria|renta piso/],
  ['educacion', /universidad|colegio|curso|udemy|platzi|matricula|academia|idiomas/],
  ['mascotas', /veterinari|mascota|petshop|purina|arena (de )?gato/],
  ['entretenimiento', /cine|cinex|cines|teatro|concierto|entrada|ticketmaster|juego|steam|playstation|nintendo/],
  ['regalos', /regalo|floristeria|jugueteria/],
  ['deudas', /tarjeta de credito|pago tarjeta|prestamo|cuota|interes/],
  ['ahorro', /ahorro|inversion|broker|binance|fondo/],
  ['sueldo', /nomina|sueldo|salario|pago de honorarios/],
]

// Se exporta porque el buscador necesita comparar exactamente igual: quien
// escribe "cafe" en el teléfono tiene que encontrar "Café".
export const normalizar = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export function categorizar(texto) {
  const t = normalizar(texto)
  if (!t) return 'otros'
  for (const [id, re] of REGLAS) if (re.test(t)) return id
  return 'otros'
}
