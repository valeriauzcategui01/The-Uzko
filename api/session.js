import { modoAcceso, permisosDe, requireUser, usuariosPublicos } from './_lib/auth.js'
import { modoAlmacen } from './_lib/store.js'

// ¿Quién está entrando y qué puede hacer? Lo usa la pantalla de acceso para
// dibujar la lista de personas, y el resto de la app para saber si mostrar el
// botón de "marcar pagado".
export default function handler(req, res) {
  const auth = requireUser(req)
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    authed: auth.ok,
    usuario: auth.ok ? auth.usuario : null,
    // Ya resueltos a sí/no. La pantalla no tiene que saber cómo se llaman los
    // roles: si mañana cambia quién puede qué, cambia aquí y el navegador se
    // entera solo. Antes esta regla estaba escrita dos veces —aquí y en
    // Sesion.jsx— y con cuatro roles eso es una de las dos quedándose vieja.
    permisos: auth.ok ? permisosDe(auth.usuario) : null,
    modo: modoAcceso(),
    // Solo id, nombre y rol. El hash de la clave no sale de aquí jamás.
    usuarios: usuariosPublicos(),
    almacen: modoAlmacen(),
  })
}
