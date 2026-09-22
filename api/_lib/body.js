// Vercel a veces entrega el body ya parseado y a veces no, según el
// Content-Type y el runtime. Esto lo normaliza para que los handlers no
// tengan que preocuparse.
export async function leerBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body)
      } catch {
        return {}
      }
    }
    return req.body
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}
