import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminLayout, { cardStyle } from './AdminLayout.jsx'

const CLIMAS = [
  { valor: 'cualquiera', etiqueta: 'Cualquiera' },
  { valor: 'frio', etiqueta: 'Frío' },
  { valor: 'templado', etiqueta: 'Templado' },
  { valor: 'calor', etiqueta: 'Calor' },
]

function formatUltimaVez(fechaISO) {
  if (!fechaISO) return 'Nunca usado'
  const dias = Math.round((Date.now() - new Date(`${fechaISO}T00:00:00`)) / 86400000)
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 0) return 'Programado'
  return `Hace ${dias} días`
}

export default function Platos() {
  const [platos, setPlatos] = useState([])
  const [error, setError] = useState('')

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [nuevoClima, setNuevoClima] = useState('cualquiera')
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  const cargarPlatos = useCallback(async () => {
    const { data, error: fetchError } = await supabase.from('vista_uso_platos').select('*').order('nombre')
    if (fetchError) {
      setError('No pudimos cargar el catálogo de platos. Probá de nuevo en unos minutos.')
      return
    }
    setError('')
    setPlatos(data ?? [])
  }, [])

  useEffect(() => {
    cargarPlatos()
  }, [cargarPlatos])

  async function agregarPlato(e) {
    e.preventDefault()
    if (!nuevoNombre.trim()) return

    setGuardandoNuevo(true)
    const { error: insertError } = await supabase
      .from('platos')
      .insert({ nombre: nuevoNombre.trim(), categoria: nuevaCategoria.trim() || null, clima: nuevoClima })
    setGuardandoNuevo(false)

    if (insertError) {
      setError('No pudimos agregar el plato. Probá de nuevo.')
      return
    }
    setNuevoNombre('')
    setNuevaCategoria('')
    setNuevoClima('cualquiera')
    cargarPlatos()
  }

  async function actualizarCampo(plato, campo, valor) {
    setPlatos((prev) => prev.map((p) => (p.id === plato.id ? { ...p, [campo]: valor } : p)))
    const { error: updateError } = await supabase.from('platos').update({ [campo]: valor }).eq('id', plato.id)
    if (updateError) {
      setError(`No pudimos guardar el cambio en "${plato.nombre}". Probá de nuevo.`)
      cargarPlatos()
    }
  }

  return (
    <AdminLayout>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 18 }}>Catálogo de platos</h1>

        {error && (
          <p role="alert" style={{ color: 'var(--color-clay-dark)', marginBottom: 16 }}>
            {error}
          </p>
        )}

        <form onSubmit={agregarPlato} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
          <label style={{ flex: '2 1 200px' }}>
            <span style={labelStyle}>Plato nuevo</span>
            <input id="nuevo-plato-nombre" name="nuevo-plato-nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej: Guiso de lentejas" style={inputStyle} />
          </label>
          <label style={{ flex: '1 1 140px' }}>
            <span style={labelStyle}>Categoría</span>
            <input id="nuevo-plato-categoria" name="nuevo-plato-categoria" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} placeholder="Ej: guiso" style={inputStyle} />
          </label>
          <label style={{ flex: '1 1 130px' }}>
            <span style={labelStyle}>Clima</span>
            <select id="nuevo-plato-clima" name="nuevo-plato-clima" value={nuevoClima} onChange={(e) => setNuevoClima(e.target.value)} style={inputStyle}>
              {CLIMAS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={guardandoNuevo || !nuevoNombre.trim()}
            style={{ padding: '10px 18px', fontSize: 15, fontWeight: 600, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-clay)', color: '#fff', whiteSpace: 'nowrap' }}
          >
            Agregar
          </button>
        </form>

        {platos.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)' }}>Todavía no cargaste ningún plato.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Plato</th>
                  <th style={thStyle}>Categoría</th>
                  <th style={thStyle}>Clima</th>
                  <th style={thStyle}>Última vez usado</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Activo</th>
                </tr>
              </thead>
              <tbody>
                {platos.map((plato) => (
                  <tr key={plato.id}>
                    <td style={tdStyle}>
                      <input
                        defaultValue={plato.nombre}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== plato.nombre && actualizarCampo(plato, 'nombre', e.target.value.trim())}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        defaultValue={plato.categoria ?? ''}
                        onBlur={(e) => e.target.value.trim() !== (plato.categoria ?? '') && actualizarCampo(plato, 'categoria', e.target.value.trim() || null)}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <select value={plato.clima} onChange={(e) => actualizarCampo(plato, 'clima', e.target.value)} style={cellInputStyle}>
                        {CLIMAS.map((c) => (
                          <option key={c.valor} value={c.valor}>
                            {c.etiqueta}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--color-ink-muted)', fontSize: 14 }}>{formatUltimaVez(plato.ultima_vez_usado)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input type="checkbox" checked={plato.activo} onChange={(e) => actualizarCampo(plato, 'activo', e.target.checked)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ color: 'var(--color-ink-muted)', fontSize: 13, marginTop: 18 }}>
          Los cambios se guardan solos. Destildar "Activo" oculta el plato al armar una semana nueva, sin borrar su historial de uso.
        </p>
      </div>
    </AdminLayout>
  )
}

const labelStyle = { display: 'block', fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 6 }

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 15,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
}

const cellInputStyle = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 14,
  borderRadius: 8,
  border: '1px solid transparent',
  background: 'transparent',
}

const thStyle = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-ink-muted)',
  borderBottom: '1px solid var(--color-border)',
}

const tdStyle = {
  padding: '4px 10px',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 15,
}
