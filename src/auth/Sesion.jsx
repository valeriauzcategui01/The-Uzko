import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// QUIÉN ESTÁ ENTRANDO.
//
// Antes esto era un sí/no: sabías la contraseña o no la sabías. Ahora la app
// necesita el nombre y el rol en todas partes —para firmar un ticket, para
// decidir si mostrar el botón de "marcar pagado"— así que la sesión vive en un
// contexto y no dentro del muro de acceso.

const Ctx = createContext(null)

export function SesionProvider({ children }) {
  const [estado, setEstado] = useState('cargando') // cargando | fuera | dentro
  const [usuario, setUsuario] = useState(null)
  const [modo, setModo] = useState('personas')
  const [usuarios, setUsuarios] = useState([])
  const [almacen, setAlmacen] = useState(null)
  const [permisos, setPermisos] = useState(null)

  const consultar = useCallback(async () => {
    try {
      const r = await fetch('/api/session', { credentials: 'include' })
      const j = await r.json()
      setModo(j.modo ?? 'personas')
      setUsuarios(j.usuarios ?? [])
      setAlmacen(j.almacen ?? null)
      setUsuario(j.usuario ?? null)
      setPermisos(j.permisos ?? null)
      setEstado(j.authed ? 'dentro' : 'fuera')
    } catch {
      setEstado('fuera')
    }
  }, [])

  useEffect(() => {
    consultar()
  }, [consultar])

  const entrar = useCallback(async (id, clave) => {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, clave }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'No se pudo entrar')
    setUsuario(j.usuario)
    setPermisos(j.permisos ?? null)
    setEstado('dentro')
    return j.usuario
  }, [])

  const salir = useCallback(async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {})
    window.location.reload()
  }, [])

  const valor = useMemo(
    () => ({
      estado,
      usuario,
      modo,
      usuarios,
      almacen,
      entrar,
      salir,
      recargar: consultar,
      // Estos permisos NO se calculan aquí: llegan resueltos de /api/session.
      //
      // Antes esta línea repetía la regla del servidor (`rol === 'admin' ||
      // rol === 'gestora'`), y con dos copias de la misma regla basta con
      // añadir un rol y actualizar solo una para que la pantalla enseñe algo
      // que el servidor niega, o al revés. Con cuatro roles eso deja de ser
      // hipotético. El servidor sigue comprobándolo en cada endpoint: esto es
      // para decidir qué dibujar, nunca para proteger nada.
      //
      // Sin sesión no hay permisos: todo en false, que es lo que hay que
      // enseñarle a quien no ha entrado.
      permisos: permisos ?? { escribir: false, cambiarTasa: false },
      puedeEscribir: Boolean(permisos?.escribir),
      puedeCambiarTasa: Boolean(permisos?.cambiarTasa),
    }),
    [estado, usuario, modo, usuarios, almacen, permisos, entrar, salir, consultar],
  )

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSesion() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSesion se usó fuera de <SesionProvider>')
  return v
}
