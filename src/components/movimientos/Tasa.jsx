import { useState } from 'react'
import { useSesion } from '../../auth/Sesion'
import { useApp } from '../../context/AppContext'
import { bolivares, dinero, desde, tasaDia } from '../../lib/format'
import { bsAEuros, eurosABs, monto, usdAEuros } from '../../lib/tasa'
import { MONEDAS_APP } from '../../config'
import Icono from '../common/Iconos'

// LAS TASAS DE HOY.
//
// La contabilidad se lleva en euros, pero los pagos llegan en tres monedas.
// Las tasas las trae el servidor del BCV una vez al día —el euro y el dólar,
// cada uno en bolívares— y quedan escritas dentro del movimiento que se creó
// con ellas: seis meses después se puede responder no solo "cuánto fue" sino
// "a cuánto estaba el cambio ese día".

// La franja: a cuánto están el euro y el dólar, de dónde salió y desde
// cuándo. Es el dato que hace que las conversiones de abajo signifiquen algo.
export function BarraTasa() {
  const { tasas, fijarTasa, tasaAutomatica } = useApp()
  const { puedeCambiarTasa } = useSesion()
  const [editando, setEditando] = useState(null) // 'eur' | 'usd' | null
  const [borrador, setBorrador] = useState('')
  const [err, setErr] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const correr = async (fn) => {
    setOcupado(true)
    setErr('')
    try {
      await fn()
      setEditando(null)
    } catch (e) {
      setErr(e.message || 'No se pudo guardar la tasa')
    } finally {
      setOcupado(false)
    }
  }

  const abrir = (moneda) => {
    const t = tasas?.[moneda]
    setBorrador(t?.bs != null ? String(t.bs).replace('.', ',') : '')
    setErr('')
    setEditando(moneda)
  }

  const eur = tasas?.eur ?? null
  const usd = tasas?.usd ?? null

  // Sin ninguna tasa no hay conversión posible, y eso hay que decirlo donde
  // se nota: si no, alguien teclea un monto en bolívares creyendo que se
  // convierte.
  if (!eur && !usd) {
    return (
      <div className="barra-tasa es-sin">
        <Icono name="alerta" size={15} />
        <span className="barra-tasa-texto">
          No se pudieron traer las tasas del día. Los montos solo se pueden escribir en euros.
        </span>
        {puedeCambiarTasa && editando == null && (
          <button className="btn btn-ghost btn-sm" onClick={() => abrir('eur')}>
            Escribir la del euro a mano
          </button>
        )}
        {editando && (
          <FormaTasa
            moneda={editando}
            valor={borrador}
            onValor={setBorrador}
            ocupado={ocupado}
            onGuardar={() => correr(() => fijarTasa(editando, borrador))}
            onCancelar={() => setEditando(null)}
          />
        )}
        {err && <span className="barra-tasa-error">{err}</span>}
      </div>
    )
  }

  const vieja = Boolean(eur?.vieja || usd?.vieja)

  return (
    <div className={`barra-tasa ${vieja ? 'es-vieja' : ''}`}>
      <span className="barra-tasa-cifra">
        <Icono name="cartera" size={15} />
        {eur && (
          <>
            <strong>{tasaDia(eur.bs)}</strong>
            <span className="barra-tasa-por">por euro</span>
          </>
        )}
        {eur && usd && <span className="barra-tasa-por">·</span>}
        {usd && (
          <>
            <strong>{tasaDia(usd.bs)}</strong>
            <span className="barra-tasa-por">por dólar</span>
          </>
        )}
      </span>

      <span className="barra-tasa-texto">
        {vieja
          ? `hoy no se pudo actualizar · es la del ${(eur?.vieja ? eur : usd)?.dia}`
          : eur?.origen === 'manual' || usd?.origen === 'manual'
            ? `corregida a mano · ${(eur?.origen === 'manual' ? eur : usd)?.por?.nombre ?? 'alguien'}`
            : `BCV vía ${eur?.fuente ?? usd?.fuente} · ${desde((eur ?? usd)?.actualizadaEl)}`}
      </span>

      {puedeCambiarTasa && editando == null && (
        <span className="barra-tasa-acciones">
          {(eur?.origen === 'manual' || usd?.origen === 'manual') && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={ocupado}
              onClick={() => correr(() => tasaAutomatica(eur?.origen === 'manual' ? 'eur' : 'usd'))}
            >
              Volver al BCV
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => abrir('eur')}>
            Corregir €
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => abrir('usd')}>
            Corregir $
          </button>
        </span>
      )}

      {editando && (
        <FormaTasa
          moneda={editando}
          valor={borrador}
          onValor={setBorrador}
          ocupado={ocupado}
          onGuardar={() => correr(() => fijarTasa(editando, borrador))}
          onCancelar={() => setEditando(null)}
        />
      )}

      {err && <span className="barra-tasa-error">{err}</span>}
    </div>
  )
}

// Corregirla es escribir un número y ya. Vale solo para hoy: mañana vuelve
// sola al BCV, para que un ajuste de un día no se quede pegado un año.
function FormaTasa({ moneda, valor, onValor, onGuardar, onCancelar, ocupado }) {
  return (
    <form
      className="barra-tasa-forma"
      onSubmit={(e) => {
        e.preventDefault()
        onGuardar()
      }}
    >
      <input
        value={valor}
        onChange={(e) => onValor(e.target.value)}
        inputMode="decimal"
        placeholder="922,69"
        autoFocus
        aria-label={moneda === 'eur' ? 'Bolívares por euro' : 'Bolívares por dólar'}
      />
      <button className="btn btn-primary btn-sm" disabled={ocupado || !valor.trim()}>
        {ocupado ? 'Guardando…' : `Guardar (${moneda === 'eur' ? '€' : '$'})`}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelar}>
        Cancelar
      </button>
      <span className="barra-tasa-nota">solo por hoy</span>
    </form>
  )
}

// ── el campo de monto ───────────────────────────────────────────────────────

// Un monto con su moneda. Se teclea en la que se pagó de verdad y debajo se
// ve, mientras se escribe, en qué se va a convertir.
//
// Enseñar la conversión antes de guardar no es adorno: es lo que evita el
// error de teclear la cifra en Bs con el selector en €, que produciría un
// gasto de mil doscientos euros y nadie lo notaría hasta el cierre del mes.
export function CampoMonto({ label, opcional, valor, onValor, moneda, onMoneda, autoFocus }) {
  const { tasas } = useApp()
  const tasaEur = tasas?.eur?.bs ?? null
  const tasaUsd = tasas?.usd?.bs ?? null

  // Cada moneda necesita lo suyo para poder convertirse. El euro, nada. El
  // bolívar, la tasa del euro. El dólar, LAS DOS, porque el BCV publica cada
  // una contra el bolívar y el cambio sale de cruzarlas.
  const sePuede = { eur: true, bs: Boolean(tasaEur), usd: Boolean(tasaEur && tasaUsd) }
  const actual = MONEDAS_APP.find((m) => m.id === moneda) ?? MONEDAS_APP[0]

  const n = monto(valor)
  const enEur =
    moneda === 'bs' ? bsAEuros(n, tasaEur)
    : moneda === 'usd' ? usdAEuros(n, tasaUsd, tasaEur)
    : n
  const enBs = moneda === 'eur' ? eurosABs(n, tasaEur) : null

  return (
    <label className="campo">
      <span className="campo-label">
        {label} {opcional && <span className="campo-opcional">opcional</span>}
      </span>

      <div className="campo-monto">
        <div className="monedas" role="group" aria-label="Moneda">
          {MONEDAS_APP.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`moneda ${moneda === m.id ? 'is-activa' : ''}`}
              onClick={() => sePuede[m.id] && onMoneda(m.id)}
              disabled={!sePuede[m.id]}
              title={
                sePuede[m.id]
                  ? `Escribir el monto en ${m.nombre}`
                  : `Hoy no hay tasa para convertir de ${m.nombre}`
              }
            >
              {m.simbolo}
            </button>
          ))}
        </div>
        <input
          value={valor}
          onChange={(e) => onValor(e.target.value)}
          inputMode="decimal"
          placeholder={actual.placeholder}
          autoFocus={autoFocus}
        />
      </div>

      {/* El equivalente aparece solo cuando hay algo escrito: un "= 0,00 €"
          debajo de un campo vacío es ruido. */}
      {n != null && (
        moneda === 'bs' ? (
          <span className="campo-conversion">
            = <strong>{dinero(enEur)}</strong>{' '}
            <span className="campo-conversion-tasa">con el euro a {tasaDia(tasaEur)}</span>
          </span>
        ) : moneda === 'usd' ? (
          <span className="campo-conversion">
            = <strong>{dinero(enEur)}</strong>{' '}
            <span className="campo-conversion-tasa">al cambio del BCV de hoy</span>
          </span>
        ) : tasaEur ? (
          <span className="campo-conversion es-suave">≈ {bolivares(enBs)}</span>
        ) : null
      )}
    </label>
  )
}
