// Subir facturas y comprobantes desde el teléfono.
//
// Una foto de una factura sale de un móvil moderno pesando entre 3 y 8 MB, y
// lo que hace falta leer en ella cabe de sobra en 1600 px. Así que antes de
// mandarla se redibuja en un canvas y se recomprime: la subida deja de fallar
// con datos móviles y el almacenamiento no se llena de píxeles que nadie mira.
//
// Los PDF y los HEIC pasan tal cual: el canvas no los sabe leer, y un PDF de
// factura ya viene liviano.

const LADO_MAX = 1600
const CALIDAD = 0.82
const LIMITE = 4 * 1024 * 1024

const esRedimensionable = (f) => /^image\/(jpeg|png|webp)$/i.test(f.type)

function leerComoImagen(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen'))
    }
    img.src = url
  })
}

async function encoger(file) {
  const img = await leerComoImagen(file)
  const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height))
  // Ya es chica: recomprimirla solo la empeoraría.
  if (escala === 1 && file.size < 900 * 1024) return file

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  const ctx = canvas.getContext('2d')
  // Fondo blanco: un PNG con transparencia pasado a JPEG saldría con fondo
  // negro y una factura escaneada se volvería ilegible.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', CALIDAD))
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}

function aBase64(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '')
    fr.onerror = () => reject(new Error('No se pudo leer el archivo'))
    fr.readAsDataURL(blob)
  })
}

// Devuelve {pathname, nombre, contentType} listo para adjuntar a un ticket.
//
// No devuelve una URL a propósito: el almacén es privado y los enlaces se
// firman en el servidor cada vez que se sirve el ticket, con caducidad. Aquí
// solo viaja la ruta del archivo.
export async function subirArchivo(file) {
  const listo = esRedimensionable(file) ? await encoger(file) : file

  if (listo.size > LIMITE) {
    throw new Error(`"${file.name}" pesa demasiado (${(listo.size / 1024 / 1024).toFixed(1)} MB). El máximo son 4 MB.`)
  }

  const datos = await aBase64(listo)
  const r = await fetch('/api/subir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ nombre: listo.name, contentType: listo.type, datos }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'No se pudo subir el archivo')
  return { pathname: j.pathname, nombre: j.nombre, contentType: j.contentType }
}

// Varios a la vez, en serie. En paralelo saturaría una conexión móvil y el
// primer fallo dejaría a los demás en el limbo; así se sabe cuál falló.
export async function subirVarios(files, alProgresar) {
  const subidos = []
  for (let i = 0; i < files.length; i++) {
    alProgresar?.({ actual: i + 1, total: files.length, nombre: files[i].name })
    subidos.push(await subirArchivo(files[i]))
  }
  return subidos
}
