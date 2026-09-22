import { useRef, useState } from 'react'
import Icono from '../common/Iconos'
import { subirVarios } from '../../lib/subir'

const esImagen = (a) => /^image\//.test(a.contentType || '')

// Selector de archivos con subida inmediata.
//
// Sube en cuanto eliges, no al guardar el formulario. Es a propósito: subir
// una foto por datos móviles tarda, y hacerlo mientras la persona todavía está
// escribiendo el resto aprovecha ese tiempo. Cuando le da a guardar, los
// archivos ya están arriba y el movimiento se crea al instante.
export function SelectorAdjuntos({ valor, onCambio, etiqueta = 'Adjuntar el ticket o recibo' }) {
  const input = useRef(null)
  const [subiendo, setSubiendo] = useState(null)
  const [err, setErr] = useState('')

  const elegir = async (e) => {
    const files = [...(e.target.files || [])]
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (!files.length) return

    setErr('')
    try {
      const nuevos = await subirVarios(files, setSubiendo)
      onCambio([...valor, ...nuevos])
    } catch (e2) {
      setErr(e2.message || 'No se pudo subir')
    } finally {
      setSubiendo(null)
    }
  }

  return (
    <div className="adjuntos-campo">
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,application/pdf"
        onChange={elegir}
        hidden
      />
      <button type="button" className="btn btn-ghost btn-adjuntar" onClick={() => input.current?.click()} disabled={Boolean(subiendo)}>
        <Icono name="clip" size={16} />
        {subiendo ? `Subiendo ${subiendo.actual} de ${subiendo.total}…` : etiqueta}
      </button>

      {err && <p className="campo-error">⚠️ {err}</p>}

      {valor.length > 0 && (
        <ul className="adjuntos-pendientes">
          {valor.map((a, i) => (
            <li key={a.pathname}>
              <Icono name="clip" size={14} />
              <span className="adjunto-nombre">{a.nombre}</span>
              <button
                type="button"
                className="adjunto-quitar"
                title="Quitar"
                onClick={() => onCambio(valor.filter((_, j) => j !== i))}
              >
                <Icono name="equis" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Los recibos ya guardados en un movimiento. Las fotos se ven; los PDF se
// abren.
//
// La `url` no viene del almacén: la firma el servidor al servir el movimiento
// y caduca a las pocas horas. Por eso puede faltar —si la firma falló— y en
// ese caso se dice, en vez de dejar el hueco de una imagen rota.
export function GaleriaAdjuntos({ adjuntos }) {
  if (!adjuntos?.length) return null
  return (
    <div className="galeria">
      {adjuntos.map((a, i) => {
        if (!a.url) {
          return (
            <span key={`${a.pathname}-${i}`} className="galeria-item es-caido" title={a.nombre}>
              <span className="galeria-doc">
                <Icono name="alerta" size={22} />
                No se pudo abrir
              </span>
              <span className="galeria-pie">Recibo</span>
            </span>
          )
        }

        return (
          <a
            key={`${a.pathname}-${i}`}
            className="galeria-item"
            href={a.url}
            target="_blank"
            rel="noreferrer"
            title={`${a.nombre} · subido por ${a.subidoPor?.nombre ?? '—'}`}
          >
            {esImagen(a) ? (
              <img src={a.url} alt={a.nombre} loading="lazy" />
            ) : (
              <span className="galeria-doc">
                <Icono name="recibo" size={22} />
                PDF
              </span>
            )}
            <span className="galeria-pie">Recibo</span>
          </a>
        )
      })}
    </div>
  )
}
