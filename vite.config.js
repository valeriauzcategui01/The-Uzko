import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Corre las funciones de /api de verdad durante `npm run dev`.
//
// Antes esto devolvía respuestas fijas, que bastaba cuando la app solo leía un
// JSON. Con los tickets ya no: hay estados, permisos y validaciones que hay
// que poder probar sin desplegar. Así que en vez de imitar las respuestas, se
// importan los mismos handlers que usa Vercel y se les da lo que esperan.
//
// La diferencia con producción es intencional y está en `api/_lib/auth.js`:
// sin USUARIOS ni SITE_PASSWORD el acceso local es abierto y actúas como
// administrador, para no tener que escribir una clave en cada recarga.
function apiDev() {
  return {
    name: 'api-dev',
    configureServer(server) {
      // Los adjuntos que se suben en local viven fuera de git, en .data/.
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/adjuntos/')) return next()
        const limpia = req.url.split('?')[0].replace(/\.\./g, '')
        const ruta = fileURLToPath(new URL(`./.data${limpia}`, import.meta.url))
        if (!existsSync(ruta)) {
          res.statusCode = 404
          return res.end('No existe')
        }
        createReadStream(ruta).pipe(res)
      })

      server.middlewares.use(async (req, res, next) => {
        const ruta = req.url.split('?')[0]
        if (!ruta.startsWith('/api/')) return next()

        const archivo = fileURLToPath(new URL(`.${ruta}.js`, import.meta.url))
        if (!existsSync(archivo)) return next()

        // Los handlers están escritos contra el `res` de Vercel, que agrega
        // .status() y .json() sobre el de Node. Se los ponemos aquí.
        res.status = (code) => {
          res.statusCode = code
          return res
        }
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
        }

        try {
          const mod = await server.ssrLoadModule(archivo)
          await mod.default(req, res)
        } catch (e) {
          server.config.logger.error(`[api-dev] ${ruta}: ${e.stack || e}`)
          res.status(500).json({ error: String(e.message || e) })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiDev()],
  // strictPort: si el 5175 está ocupado, Vite NO salta en silencio a otro
  // puerto — falla y se ve. La lección viene de las apps hermanas: sin esto se
  // termina midiendo el servidor viejo de otra sesión sin saberlo.
  server: { port: 5175, strictPort: true },
})
