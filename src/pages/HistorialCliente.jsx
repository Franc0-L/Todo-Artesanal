import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DIA_LABEL, formatFecha } from '../lib/format'
import AdminLayout, { cardStyle } from './AdminLayout.jsx'

const ETIQUETA_TIPO = {
  general: 'General',
  opcional: 'Opcional',
  no_come: 'No come este día',
}

export default function HistorialCliente() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [diasConSemana, setDiasConSemana] = useState([])
  const [pedidosCliente, setPedidosCliente] = useState([])
  const [platosPorId, setPlatosPorId] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargarInicial() {
      const { data } = await supabase.from('clientes').select('id, nombre').order('nombre')
      setClientes(data ?? [])
      if (data?.length) setClienteId(data[0].id)
    }
    cargarInicial()
  }, [])

  useEffect(() => {
    async function cargarHistorialCompleto() {
      const [{ data: diasData, error: diasError }, { data: platosData }] = await Promise.all([
        supabase.from('dias_menu').select('id, dia_semana, fecha, plato_general_id, plato_opcional_id, semanas(fecha_inicio)').order('fecha', { ascending: false }),
        supabase.from('platos').select('id, nombre'),
      ])
      if (diasError) {
        setError('No pudimos cargar el historial. Probá de nuevo.')
        return
      }
      setDiasConSemana(diasData ?? [])
      setPlatosPorId(Object.fromEntries((platosData ?? []).map((p) => [p.id, p.nombre])))
    }
    cargarHistorialCompleto()
  }, [])

  useEffect(() => {
    if (!clienteId) return
    supabase
      .from('pedidos')
      .select('dia_menu_id, tipo_menu')
      .eq('cliente_id', clienteId)
      .then(({ data }) => setPedidosCliente(data ?? []))
  }, [clienteId])

  const filas = useMemo(
    () =>
      diasConSemana.map((dia) => {
        const pedido = pedidosCliente.find((p) => p.dia_menu_id === dia.id)
        return {
          id: dia.id,
          fecha: dia.fecha,
          diaSemana: dia.dia_semana,
          semanaInicio: dia.semanas?.fecha_inicio,
          eleccion: pedido ? ETIQUETA_TIPO[pedido.tipo_menu] : 'No pidió',
          plato:
            pedido?.tipo_menu === 'general'
              ? platosPorId[dia.plato_general_id]
              : pedido?.tipo_menu === 'opcional'
              ? platosPorId[dia.plato_opcional_id]
              : null,
          respondio: Boolean(pedido) && pedido.tipo_menu !== 'no_come',
        }
      }),
    [diasConSemana, pedidosCliente, platosPorId]
  )

  return (
    <AdminLayout>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Historial por cliente</h1>
        <p style={{ color: 'var(--color-ink-muted)', fontSize: 14, marginBottom: 18 }}>
          Qué pidió (o no) un cliente, semana por semana.
        </p>

        {error && (
          <p role="alert" style={{ color: 'var(--color-clay-dark)', marginBottom: 16 }}>
            {error}
          </p>
        )}

        {clientes.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)' }}>Todavía no cargaste ningún cliente.</p>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 20, maxWidth: 320 }}>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 6 }}>Cliente</span>
              <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={selectStyle}>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            {filas.length === 0 ? (
              <p style={{ color: 'var(--color-ink-muted)' }}>Todavía no hay ninguna semana cargada.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Fecha</th>
                      <th style={thStyle}>Semana</th>
                      <th style={thStyle}>Eligió</th>
                      <th style={thStyle}>Plato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.id}>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          {DIA_LABEL[f.diaSemana]} <span style={{ color: 'var(--color-ink-muted)', fontSize: 13 }}>{formatFecha(f.fecha)}</span>
                        </td>
                        <td style={{ ...tdStyle, color: 'var(--color-ink-muted)', fontSize: 13 }}>
                          {f.semanaInicio ? formatFecha(f.semanaInicio) : '—'}
                        </td>
                        <td style={{ ...tdStyle, color: f.respondio ? 'var(--color-ink)' : 'var(--color-ink-muted)' }}>{f.eleccion}</td>
                        <td style={tdStyle}>{f.plato ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 15,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
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
  padding: '6px 10px',
  borderBottom: '1px solid var(--color-border)',
  fontSize: 15,
}
