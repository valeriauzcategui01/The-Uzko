import { createHash } from 'node:crypto'

// Genera la entrada de una persona para la variable USUARIOS de Vercel.
//
//   npm run clave -- valerio "Valerio" admin
//
// La clave NO se pasa por la línea de comandos a propósito: quedaría en el
// historial del terminal. Se escribe cuando el script la pide.
//
// Lo que imprime se pega dentro del array de USUARIOS. La clave en claro no
// se guarda en ningún lado: si se pierde, se genera otra.

// Tiene que coincidir con ROLES en api/_lib/auth.js, que es quien manda: el
// servidor descarta cualquier rol que no conozca y lo deja en "admin".
const ROLES = {
  admin: 'todo: registra, edita, anula, maneja cuentas, presupuesto y tasa',
  invitado: 'solo mira: ve el resumen y los movimientos, no toca nada',
}

const [id, nombre, rol = 'admin'] = process.argv.slice(2)

if (!id || !nombre) {
  console.error('\nUso:  npm run clave -- <id> "<Nombre>" [rol]\n')
  console.error('  id      corto y sin espacios: valerio, eduardo')
  console.error('  Nombre  como debe verse en pantalla: "Valerio"')
  console.error('  rol     uno de:\n')
  for (const [r, q] of Object.entries(ROLES)) console.error(`    ${r.padEnd(9)} ${q}`)
  console.error('\nEjemplo:  npm run clave -- valerio "Valerio" admin\n')
  process.exit(1)
}

if (!ROLES[rol]) {
  console.error(`\nRol desconocido: "${rol}". Tiene que ser ${Object.keys(ROLES).join(', ')}.\n`)
  process.exit(1)
}

const preguntar = () =>
  new Promise((resolve) => {
    process.stdout.write(`Clave para ${nombre}: `)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (d) => {
      process.stdin.pause()
      resolve(String(d).trim())
    })
  })

const clave = await preguntar()

if (clave.length < 6) {
  console.error('\nLa clave necesita al menos 6 caracteres.\n')
  process.exit(1)
}

const hash = createHash('sha256').update(`${id.trim()}:${clave}`).digest('hex')
const entrada = { id: id.trim(), nombre: nombre.trim(), rol, hash }

console.log('\n── Pega esto dentro del array de USUARIOS en Vercel ──\n')
console.log(JSON.stringify(entrada))
console.log(`\n${nombre} entrará eligiendo su nombre y escribiendo esa clave.`)
console.log(`Rol "${rol}": ${ROLES[rol]}.\n`)
