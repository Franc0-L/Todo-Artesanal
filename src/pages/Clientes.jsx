import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AdminLayout, { cardStyle } from './AdminLayout.jsx'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [error, setError] = useState('')
  const [copiado, setCopiado] = useState(null)

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [nuevosCuidados, setNuevosCuidados] = useState('')
  const [guardandoNuevo, setGuardandoNuevo] = useState(false)

  const cargarClientes = useCallback(async () => {
    const { data, error: fetchError } = await supabase.from('clientes').select('*').order('nombre')
    if (fetchError) {
      setError('No pudimos cargar los clientes. Probá de nuevo en unos minutos.')
      return
    }
    setError('')
    setClientes(data ?? [])
  }, [])

  useEffect(() => {
    cargarClientes()
  }, [cargarClientes])

  async function agregarCliente(e) {
    e.preventDefault()
    if (!nuevoNombre.trim()) return

    setGuardandoNuevo(true)
    const { error: insertError } = await supabase.from('clientes').insert({
      nombre: nuevoNombre.trim(),
      telefono: nuevoTelefono.trim() || null,
      cuidados_alimentarios: nuevosCuidados.trim() || null,
    })
    setGuardandoNuevo(false)

    if (insertError) {
      setError('No pudimos agregar el cliente. Probá de nuevo.')
      return
    }
    setNuevoNombre('')
    setNuevoTelefono('')
    setNuevosCuidados('')
    cargarClientes()
  }

  async function actualizarCampo(cliente, campo, valor) {
    setClientes((prev) => prev.map((c) => (c.id === cliente.id ? { ...c, [campo]: valor } : c)))
    const { error: updateError } = await supabase.from('clientes').update({ [campo]: valor }).eq('id', cliente.id)
    if (updateError) {
      setError(`No pudimos guardar el cambio en "${cliente.nombre}". Probá de nuevo.`)
      cargarClientes()
    }
  }

  async function copiarLink(cliente) {
    const url = `${window.location.origin}/menu/${cliente.token}`
    await navigator.clipboard.writeText(url)
    setCopiado(cliente.id)
    setTimeout(() => setCopiado(null), 1500)
  }

  return (
    <AdminLayout>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Clientes</h1>
        <p style={{ color: 'var(--color-ink-muted)', fontSize: 14, marginBottom: 18 }}>
          Ningún cliente necesita registrarse — al agregarlo acá se le genera su link personal solo.
        </p>

        {error && (
          <p role="alert" style={{ color: 'var(--color-clay-dark)', marginBottom: 16 }}>
            {error}
          </p>
        )}

        <form onSubmit={agregarCliente} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
          <label style={{ flex: '1 1 180px' }}>
            <span style={labelStyle}>Nombre</span>
            <input id="nuevo-cliente-nombre" name="nuevo-cliente-nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="Ej: Ana Gómez" style={inputStyle} />
          </label>
          <label style={{ flex: '1 1 150px' }}>
            <span style={labelStyle}>Teléfono</span>
            <input id="nuevo-cliente-telefono" name="nuevo-cliente-telefono" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} placeholder="Opcional" style={inputStyle} />
          </label>
          <label style={{ flex: '2 1 220px' }}>
            <span style={labelStyle}>Cuidado especial</span>
            <input
              id="nuevo-cliente-cuidados"
              name="nuevo-cliente-cuidados"
              value={nuevosCuidados}
              onChange={(e) => setNuevosCuidados(e.target.value)}
              placeholder="Ej: sin sal, diabético…"
              style={inputStyle}
            />
          </label>
          <button
            type="submit"
            disabled={guardandoNuevo || !nuevoNombre.trim()}
            style={{ padding: '10px 18px', fontSize: 15, fontWeight: 600, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-clay)', color: '#fff', whiteSpace: 'nowrap' }}
          >
            Agregar
          </button>
        </form>

        {clientes.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)' }}>Todavía no cargaste ningún cliente.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Nombre</th>
                  <th style={thStyle}>Teléfono</th>
                  <th style={thStyle}>Cuidado especial</th>
                  <th style={thStyle}>Precio general esp.</th>
                  <th style={thStyle}>Precio opcional esp.</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Activo</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td style={tdStyle}>
                      <input
                        defaultValue={cliente.nombre}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== cliente.nombre && actualizarCampo(cliente, 'nombre', e.target.value.trim())}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        defaultValue={cliente.telefono ?? ''}
                        onBlur={(e) => e.target.value.trim() !== (cliente.telefono ?? '') && actualizarCampo(cliente, 'telefono', e.target.value.trim() || null)}
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        defaultValue={cliente.cuidados_alimentarios ?? ''}
                        onBlur={(e) =>
                          e.target.value.trim() !== (cliente.cuidados_alimentarios ?? '') &&
                          actualizarCampo(cliente, 'cuidados_alimentarios', e.target.value.trim() || null)
                        }
                        style={cellInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        placeholder="—"
                        defaultValue={cliente.precio_general_especial ?? ''}
                        onBlur={(e) => {
                          const valor = e.target.value === '' ? null : Number(e.target.value)
                          if (valor !== (cliente.precio_general_especial ?? null)) actualizarCampo(cliente, 'precio_general_especial', valor)
                        }}
                        style={{ ...cellInputStyle, width: 100 }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        placeholder="—"
                        defaultValue={cliente.precio_opcional_especial ?? ''}
                        onBlur={(e) => {
                          const valor = e.target.value === '' ? null : Number(e.target.value)
                          if (valor !== (cliente.precio_opcional_especial ?? null)) actualizarCampo(cliente, 'precio_opcional_especial', valor)
                        }}
                        style={{ ...cellInputStyle, width: 100 }}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input type="checkbox" checked={cliente.activo} onChange={(e) => actualizarCampo(cliente, 'activo', e.target.checked)} />
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => copiarLink(cliente)} style={linkBtnStyle}>
                        {copiado === cliente.id ? '¡Copiado!' : 'Copiar enlace'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ color: 'var(--color-ink-muted)', fontSize: 13, marginTop: 18 }}>
          "Precio esp." es opcional — solo para clientes con una tarifa negociada aparte. Dejalo vacío para que use el precio de la semana.
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

const linkBtnStyle = {
  background: 'none',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  padding: '5px 10px',
  fontSize: 13,
  color: 'var(--color-clay-dark)',
  whiteSpace: 'nowrap',
}
