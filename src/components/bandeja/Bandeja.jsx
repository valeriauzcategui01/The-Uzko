import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useSesion } from '../../auth/Sesion'
import { Card, Cargando, ErrorAviso, Vacio } from '../common/Ui'
import Icono from '../common/Iconos'
import { desde } from '../../lib/format'
import { categoriaLabel } from '../../config'
import NuevoMovimiento from '../movimientos/NuevoMovimiento'
import { CategoriaChip } from '../movimientos/piezas'

// LA BANDEJA DE ENTRADA: los mensajes del banco que llegaron solos.
//
// Cada compra que Valerio hace con la tarjeta le genera un SMS, y ese SMS
// llega aquí por el webhook (MacroDroid en su teléfono) o por "Compartir a
// Uzko". El parser ya leyó monto, moneda y comercio; a ella le queda UN
// toque: confirmar, y el gasto entra con todo y categoría. O descartar, si
// era publicidad o un duplicado.
//
// NADA se registra solo. Un parser que se equivoca en silencio es un mes que
// miente; por eso el gasto siempre pasa por el formulario, ya pre-llenado.

const NOMBRE_MONEDA = { eur: '€', usd: '$', bs: 'Bs' }

export default function Bandeja() {
  const { setBandejaNuevas } = useApp()
  const { puedeEscribir } = useSesion()
  const [entradas, setEntradas] = useState(null)
  const [error, setError] = useState(null)
  const [confirmando, setConfirmando] = useState(null) // entrada
  const [verTodas, setVerTodas] = useState(false)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const r = await fetch('/api/bandeja', { credentials: 'include' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `El servidor respondió ${r.status}`)
      setEntradas(j.entradas ?? [])
    } catch (e) {
      setError(e.message || 'No se pudo cargar la bandeja')
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const marcar = useCallback(
    async (id, estado, movimientoId = null) => {
      const r = await fetch('/api/bandeja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accion: 'marcar', id, estado, movimientoId }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'No se pudo actualizar')
      setEntradas((prev) => prev.map((e) => (e.id === j.entrada.id ? j.entrada : e)))
      // El contador del menú baja al momento, sin esperar otra carga.
      setBandejaNuevas((n) => Math.max(0, n + (estado === 'nueva' ? 1 : -1)))
    },
    [setBandejaNuevas],
  )

  const nuevas = useMemo(() => (entradas ?? []).filter((e) => e.estado === 'nueva'), [entradas])
  const decididas = useMemo(() => (entradas ?? []).filter((e) => e.estado !== 'nueva'), [entradas])

  if (error) return <ErrorAviso mensaje={error} onReintentar={cargar} />
  if (entradas == null) return <Cargando>Cargando la bandeja…</Cargando>

  return (
    <div className="vista">
      <Card
        title="Bandeja de entrada"
        subtitle="Los mensajes del banco, leídos y listos para confirmar con un toque"
      >
        {nuevas.length === 0 ? (
          <Vacio>
            No hay mensajes esperando. Cuando el teléfono reenvíe un SMS del banco —o compartas una
            notificación con Uzko— aparece aquí para confirmarlo.
          </Vacio>
        ) : (
          <div className="ticket-lista">
            {nuevas.map((e) => (
              <EntradaFila
                key={e.id}
                entrada={e}
                puedeEscribir={puedeEscribir}
                onConfirmar={() => setConfirmando(e)}
                onDescartar={() => marcar(e.id, 'descartada').catch(() => {})}
              />
            ))}
          </div>
        )}
      </Card>

      {decididas.length > 0 && (
        <Card
          title="Ya decididas"
          subtitle="Lo que se confirmó o se descartó, por si hay que revisar"
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => setVerTodas((v) => !v)}>
              {verTodas ? 'Esconder' : `Ver ${decididas.length}`}
            </button>
          }
        >
          {verTodas && (
            <div className="ticket-lista">
              {decididas.map((e) => (
                <div key={e.id} className="entrada-decidida">
                  <span className={`estado-pill ${e.estado === 'usada' ? 'es-pagado' : 'es-cancelado'}`}>
                    {e.estado === 'usada' ? 'Registrada' : 'Descartada'}
                  </span>
                  <span className="entrada-texto">{e.texto}</span>
                  <span className="dato-pie">{desde(e.recibidoEl)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <ComoConectar />

      {confirmando && (
        <NuevoMovimiento
          prefill={{
            tipo: confirmando.parse?.tipo ?? 'gasto',
            titulo: confirmando.parse?.comercio ?? '',
            monto: confirmando.parse?.monto ?? '',
            moneda: confirmando.parse?.moneda ?? 'eur',
            fecha: confirmando.parse?.fecha ?? undefined,
            categoria: confirmando.categoriaPropuesta ?? '',
            textoOriginal: confirmando.texto,
          }}
          onCerrar={() => setConfirmando(null)}
          onCreado={(mov) => marcar(confirmando.id, 'usada', mov.id).catch(() => {})}
        />
      )}
    </div>
  )
}

function EntradaFila({ entrada, puedeEscribir, onConfirmar, onDescartar }) {
  const p = entrada.parse ?? {}
  const entendio = p.monto != null

  return (
    <div className="entrada-fila">
      <span className="entrada-icono" aria-hidden>
        <Icono name="recibo" size={18} />
      </span>
      <div className="entrada-cuerpo">
        <div className="entrada-linea1">
          {entendio ? (
            <strong>
              {NOMBRE_MONEDA[p.moneda] ?? ''} {p.monto}
              {p.comercio ? ` · ${p.comercio}` : ''}
            </strong>
          ) : (
            <strong>No se pudo leer el monto</strong>
          )}
          {entrada.categoriaPropuesta && entrada.categoriaPropuesta !== 'otros' && (
            <CategoriaChip categoria={entrada.categoriaPropuesta} />
          )}
        </div>
        <p className="entrada-texto">{entrada.texto}</p>
        <span className="dato-pie">
          {desde(entrada.recibidoEl)} · llegó por {entrada.origen === 'compartir' ? 'compartir' : entrada.origen}
          {entendio && entrada.categoriaPropuesta ? ` · propuesta: ${categoriaLabel(entrada.categoriaPropuesta)}` : ''}
        </span>
      </div>
      {puedeEscribir && (
        <div className="entrada-acciones">
          <button className="btn btn-primary btn-sm" onClick={onConfirmar}>
            <Icono name="check" size={14} /> Confirmar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onDescartar}>
            Descartar
          </button>
        </div>
      )}
    </div>
  )
}

// La guía para conectar el teléfono, siempre a la vista al final de la
// bandeja: es lo que hay que configurar UNA vez para que esto se llene solo.
function ComoConectar() {
  const [abierta, setAbierta] = useState(false)
  return (
    <Card
      title="Conectar el teléfono"
      subtitle="Para que los SMS del banco lleguen solos a esta bandeja"
      action={
        <button className="btn btn-ghost btn-sm" onClick={() => setAbierta((v) => !v)}>
          {abierta ? 'Esconder' : 'Ver los pasos'}
        </button>
      }
    >
      {abierta && (
        <ol className="guia-pasos">
          <li>
            Instala <strong>MacroDroid</strong> (gratis, en Google Play) en el teléfono donde llegan
            los SMS del banco.
          </li>
          <li>
            Crea una macro nueva. <strong>Disparador:</strong> "SMS recibido" → elige el número o
            remitente del banco.
          </li>
          <li>
            <strong>Acción:</strong> "Petición HTTP" → método <strong>POST</strong>, URL:
            <code className="guia-url">https://TU-APP.vercel.app/api/inbox?token=TU_TOKEN</code>
          </li>
          <li>
            En el cuerpo (Content-Type <code>application/json</code>) pon:
            <code className="guia-url">{'{"texto":"[sms_message]","origen":"sms"}'}</code>
          </li>
          <li>
            El <strong>token</strong> es la variable <code>INBOX_TOKEN</code> configurada en Vercel:
            sin él, el webhook no acepta nada.
          </li>
          <li>
            Listo: cada SMS del banco aparece aquí al instante, leído y con su categoría propuesta.
            También puedes <strong>compartir</strong> cualquier notificación o mensaje con la app
            Uzko desde el menú compartir de Android.
          </li>
        </ol>
      )}
    </Card>
  )
}
