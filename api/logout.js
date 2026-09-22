import { clearCookieHeader } from './_lib/auth.js'

export default function handler(req, res) {
  res.setHeader('Set-Cookie', clearCookieHeader())
  res.status(200).json({ ok: true })
}
