import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DIA_LABEL, formatFecha } from '../lib/format'
import AdminLayout, { cardStyle } from './AdminLayout.jsx'

export default function Cancelaciones() {
  const [semanas, setSemanas] = useState([])
  const [semanaId, setSemanaId] = useState('')
  const [dias, setDias] = useState([])
  const [clientes, setClientes] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargarInicial() {
      const { data: semanasData } = await supabase.from('semanas').select('*').order('fecha_inicio', { ascending: false })
      setSemanas(semanasData ?? [])
      const activa = semanasData?.find((s) => s.activa)
      setSemanaId(activa?.id ?? semanasData?.[0]?.id ?? '')
    }
    cargarInicial()
  }, [])

  useEffect(() => {
    if (!semanaId) return
    async function cargarSemana() {
      setError('')
      const [{ data: diasData, error: diasError }, { data: clientesData, error: clientesError }, { data: pedidosData, error: pedidosError }] = await Promise.all([
        supabase.from('dias_menu').select('*').eq('semana_id', semanaId).order('fecha'),
        supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
        supabase.from('pedidos').select('cliente_id, dia_menu_id, tipo_menu'),
      ])
      if (diasError || clientesError || pedidosError) {
        setError('No pudimos cargar esta información. Probá de nuevo.')
        return
      }
      setDias(diasData ?? [])
      setClientes(clientesData ?? [])
      setPedidos(pedidosData ?? [])
    }
    cargarSemana()
  }, [semanaId])

  const filas = useMemo(() => {
    const resultado = []
    for (const dia of dias) {
      for (const cliente of clientes) {
        const pedido = pedidos.find((p) => p.cliente_id === cliente.id && p.dia_menu_id === dia.id)
        if (!pedido) {
          resultado.push({ id: `${cliente.id}-${dia.id}`, cliente: cliente.nombre, dia: dia.dia_semana, fecha: dia.fecha, motivo: 'Sin responder' })
        } else if (pedido.tipo_menu === 'no_come') {
          resultado.push({ id: `${cliente.id}-${dia.id}`, cliente: cliente.nombre, dia: dia.dia_semana, fecha: dia.fecha, motivo: 'No come este día' })
        }
      }
    }
    return resultado.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.cliente.localeCompare(b.cliente))
  }, [dias, clientes, pedidos])

  return (
    <AdminLayout>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Cancelaciones y sin responder</h1>
        <p style={{ color: 'var(--color-ink-muted)', fontSize: 14, marginBottom: 18 }}>
          Quién no pidió o avisó que no come, día por día, para una semana.
        </p>

        {error && (
          <p role="alert" style={{ color: 'var(--color-clay-dark)', marginBottom: 16 }}>
            {error}
          </p>
        )}

        {semanas.length === 0 ? (
          <p style={{ color: 'var(--color-ink-muted)' }}>Todavía no hay ninguna semana cargada.</p>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 20, maxWidth: 320 }}>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 6 }}>Semana</span>
              <select value={semanaId} onChange={(e) => setSemanaId(e.target.value)} style={selectStyle}>
                {semanas.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatFecha(s.fecha_inicio)} {s.activa ? '(activa)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {filas.length === 0 ? (
              <p style={{ color: 'var(--color-ink-muted)' }}>Todos respondieron y pidieron algo todos los días. 🎉</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Cliente</th>
                      <th style={thStyle}>Día</th>
                      <th style={thStyle}>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.id}>
                        <td style={tdStyle}>{f.cliente}</td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                          {DIA_LABEL[f.dia]} <span style={{ color: 'var(--color-ink-muted)', fontSize: 13 }}>{formatFecha(f.fecha)}</span>
                        </td>
                        <td style={{ ...tdStyle, color: f.motivo === 'Sin responder' ? 'var(--color-ink-muted)' : 'var(--color-clay-dark)' }}>{f.motivo}</td>
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
