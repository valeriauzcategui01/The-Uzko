import { timingSafeEqual } from 'node:crypto'
import { recibir } from './_lib/bandeja.js'
import { modoAlmacen } from './_lib/store.js'

// EL WEBHOOK DEL TELÉFONO.
//
// Aquí llegan los SMS del banco, reenviados solos por un automatizador
// (MacroDroid, Tasker, Automate…) configurado en el teléfono de Valeria:
// "cuando llegue un SMS del número del banco → POST a esta URL". La app no
// puede leer los SMS por sí misma —Android no le da ese permiso a una web—,
// así que este endpoint es el puente.
//
// NO tiene sesión: el teléfono manda sin cookies. En su lugar, un token
// secreto (variable INBOX_TOKEN en Vercel) que viaja en la cabecera
// `x-inbox-token` o en `?token=`. Sin token configurado, el endpoint está
// cerrado: mejor un webhook apagado que uno abierto al que cualquiera le
// pueda inyectar "gastos".
//
// Y aunque el token se filtrara, lo peor que puede hacer alguien es meter
// entradas en la bandeja: NADA de lo que llega aquí se convierte en gasto
// sin que una persona lo confirme dentro de la app.
//
// Config de MacroDroid (una vez, en el teléfono de ella):
//   Trigger:  SMS recibido · del número del banco
//   Acción:   HTTP Request POST · https://<app>.vercel.app/api/inbox?token=…
//             Content-Type: application/json
//             Body: {"texto":"[sms_message]","origen":"sms"}

function tokenValido(req) {
  const secreto = process.env.INBOX_TOKEN
  if (!secreto) return false
  const enviado =
    req.headers['x-inbox-token'] ?? String(req.url.match(/[?&]token=([^&]+)/)?.[1] ?? '')
  const a = Buffer.from(String(enviado))
  const b = Buffer.from(String(secreto))
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }
  if (!tokenValido(req)) {
    res.status(process.env.INBOX_TOKEN ? 401 : 503).json({
      error: process.env.INBOX_TOKEN
        ? 'Token incorrecto'
        : 'El webhook está apagado: falta la variable INBOX_TOKEN en Vercel.',
    })
    return
  }
  if (modoAlmacen() === 'sin-configurar') {
    res.status(503).json({ error: 'No hay dónde guardar: falta conectar Redis en Vercel.' })
    return
  }

  // El body puede venir como JSON ({"texto": "..."}) o como texto plano,
  // según qué tan configurable sea el automatizador. Se aceptan los dos.
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')

  // Además del texto libre, se aceptan campos YA estructurados: `comercio`,
  // `monto` y `moneda`. Es el camino del iPhone de Valeria — la
  // automatización "Transacción" de Atajos recibe de Wallet esas variables
  // cada vez que paga con Apple Pay, así que aquí llegan exactas y el parser
  // no tiene que adivinar nada. Cuerpo típico del atajo:
  //   {"origen":"applepay","comercio":"Comercio","monto":"Importe","moneda":"EUR"}
  let texto = ''
  let origen = 'sms'
  let extra = {}
  try {
    const j = JSON.parse(raw)
    texto = String(j?.texto ?? j?.text ?? j?.message ?? j?.body ?? '')
    if (['correo', 'compartir', 'applepay'].includes(j?.origen)) origen = j.origen
    extra = { comercio: j?.comercio, monto: j?.monto, moneda: j?.moneda }
  } catch {
    texto = raw
  }

  try {
    const entrada = await recibir(texto, origen, extra)
    // Respuesta mínima: el automatizador no la lee, pero sirve para probar
    // el webhook a mano con curl y ver qué entendió el parser.
    res.status(200).json({ ok: true, id: entrada.id, parse: entrada.parse })
  } catch (e) {
    res.status(400).json({ error: e.message || 'No se pudo guardar el mensaje' })
  }
}
