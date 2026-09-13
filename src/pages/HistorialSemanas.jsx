import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DIA_LABEL, formatFecha, formatMonto } from '../lib/format'
import AdminLayout, { cardStyle } from './AdminLayout.jsx'

export default function HistorialSemanas() {
  const [semanas, setSemanas] = useState([])
  const [semanaId, setSemanaId] = useState('')
  const [dias, setDias] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [totalClientesActivos, setTotalClientesActivos] = useState(0)
  const [platosPorId, setPlatosPorId] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargarInicial() {
      const [{ data: semanasData }, { data: platosData }, { count }] = await Promise.all([
        supabase.from('semanas').select('*').order('fecha_inicio', { ascending: false }),
        supabase.from('platos').select('id, nombre'),
        supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('activo', true),
      ])
      setSemanas(semanasData ?? [])
      setPlatosPorId(Object.fromEntries((platosData ?? []).map((p) => [p.id, p.nombre])))
      setTotalClientesActivos(count ?? 0)
      if (semanasData?.length) setSemanaId(semanasData[0].id)
    }
    cargarInicial()
  }, [])

  useEffect(() => {
    if (!semanaId) return
    async function cargarSemana() {
      setError('')
      const [{ data: diasData, error: diasError }, { data: pedidosData, error: pedidosError }] = await Promise.all([
        supabase.from('dias_menu').select('*').eq('semana_id', semanaId).order('fecha'),
        supabase.from('vista_pedidos_semana').select('*').eq('semana_id', semanaId),
      ])
      if (diasError || pedidosError) {
        setError('No pudimos cargar el detalle de esa semana. Probá de nuevo.')
        return
      }
      setDias(diasData ?? [])
      setPedidos(pedidosData ?? [])
    }
    cargarSemana()
  }, [semanaId])

  const filas = useMemo(
    () =>
      dias.map((dia) => {
        const pedidosDia = pedidos.filter((p) => p.dia_menu_id === dia.id)
        const general = pedidosDia.filter((p) => p.tipo_menu === 'general').length
        const opcional = pedidosDia.filter((p) => p.tipo_menu === 'opcional').length
        const noCome = pedidosDia.filter((p) => p.tipo_menu === 'no_come').length
        const sinResponder = Math.max(totalClientesActivos - general - opcional - noCome, 0)
        const total = pedidosDia.reduce((acc, p) => acc + Number(p.monto), 0)
        return {
          id: dia.id,
          diaSemana: dia.dia_semana,
          fecha: dia.fecha,
          general: platosPorId[dia.plato_general_id] ?? '—',
          opcional: platosPorId[dia.plato_opcional_id] ?? '—',
          countGeneral: general,
          countOpcional: opcional,
          countNoCome: noCome,
          countSinResponder: sinResponder,
          total,
        }
      }),
    [dias, pedidos, totalClientesActivos, platosPorId]
  )

  const totalSemana = filas.reduce((acc, f) => acc + f.total, 0)
  const semanaActual = semanas.find((s) => s.id === semanaId)

  return (
    <AdminLayout>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 6 }}>Historial de semanas</h1>
        <p style={{ color: 'var(--color-ink-muted)', fontSize: 14, marginBottom: 18 }}>
          Elegí una semana para ver cuántos pidieron cada día y cuánto se facturó.
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

            {semanaActual && (
              <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginBottom: 16 }}>
                Precio general: {formatMonto(semanaActual.precio_general)} · Precio opcional: {formatMonto(semanaActual.precio_opcional)}
              </p>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 680 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Día</th>
                    <th style={thStyle}>General</th>
                    <th style={thStyle}>Opcional</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>G</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>O</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>No come</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Sin responder</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id}>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {DIA_LABEL[f.diaSemana]} <span style={{ color: 'var(--color-ink-muted)', fontSize: 13 }}>{formatFecha(f.fecha)}</span>
                      </td>
                      <td style={tdStyle}>{f.general}</td>
                      <td style={tdStyle}>{f.opcional}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{f.countGeneral}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{f.countOpcional}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{f.countNoCome}</td>
                      <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-ink-muted)' }}>{f.countSinResponder}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatMonto(f.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                      Total semana
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>{formatMonto(totalSemana)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
