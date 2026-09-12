import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { DIA_LABEL, formatFecha } from '../lib/format'
import AdminLayout, { cardStyle } from './AdminLayout.jsx'

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']

function proximoLunes() {
  const hoy = new Date()
  const diff = (8 - hoy.getDay()) % 7 || 7
  hoy.setDate(hoy.getDate() + diff)
  return hoy.toISOString().slice(0, 10)
}

function sumarDias(fechaISO, n) {
  const d = new Date(`${fechaISO}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function diaVacio() {
  return { plato_general_id: '', plato_opcional_id: '' }
}

export default function NuevaSemana() {
  const navigate = useNavigate()
  const [semanaActivaActual, setSemanaActivaActual] = useState(null)
  const [platos, setPlatos] = useState([])
  const [cargandoPlatos, setCargandoPlatos] = useState(true)

  const [fechaInicio, setFechaInicio] = useState(proximoLunes())
  const [precioGeneral, setPrecioGeneral] = useState('')
  const [precioOpcional, setPrecioOpcional] = useState('')
  const [dias, setDias] = useState(Object.fromEntries(DIAS_SEMANA.map((d) => [d, diaVacio()])))

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('semanas')
      .select('fecha_inicio')
      .eq('activa', true)
      .maybeSingle()
      .then(({ data }) => setSemanaActivaActual(data ?? null))

    supabase
      .from('platos')
      .select('*')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => {
        setPlatos(data ?? [])
        setCargandoPlatos(false)
      })
  }, [])

  function actualizarDia(dia, campo, valor) {
    setDias((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }))
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')

    if (!fechaInicio || !precioGeneral || !precioOpcional) {
      setError('Completá la fecha de inicio y los dos precios.')
      return
    }

    const faltante = DIAS_SEMANA.find((d) => !dias[d].plato_general_id || !dias[d].plato_opcional_id)
    if (faltante) {
      setError(`Falta elegir el plato general u opcional de ${DIA_LABEL[faltante]}.`)
      return
    }

    const p_dias = DIAS_SEMANA.map((d) => ({
      dia_semana: d,
      fecha: sumarDias(fechaInicio, DIAS_SEMANA.indexOf(d)),
      plato_general_id: dias[d].plato_general_id,
      plato_opcional_id: dias[d].plato_opcional_id,
    }))

    setGuardando(true)
    const { error: rpcError } = await supabase.rpc('crear_semana', {
      p_fecha_inicio: fechaInicio,
      p_precio_general: Number(precioGeneral),
      p_precio_opcional: Number(precioOpcional),
      p_dias,
    })
    setGuardando(false)

    if (rpcError) {
      console.error(rpcError)
      setError('No pudimos crear la semana. Revisá los datos e intentá de nuevo.')
      return
    }

    navigate('/admin')
  }

  if (cargandoPlatos) return <AdminLayout />

  if (platos.length === 0) {
    return (
      <AdminLayout>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Cargar semana nueva</h1>
          <p style={{ color: 'var(--color-ink-muted)' }}>
            Todavía no hay platos en el catálogo. Cargá algunos primero en{' '}
            <Link to="/admin/platos">Catálogo de platos</Link> y volvé acá.
          </p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Cargar semana nueva</h1>

        {semanaActivaActual && (
          <p style={{ fontSize: 14, color: 'var(--color-clay-dark)', background: 'var(--color-clay-bg)', borderRadius: 'var(--radius-md)', padding: '10px 14px', margin: '10px 0 20px' }}>
            Ya hay una semana activa (del {formatFecha(semanaActivaActual.fecha_inicio)}). Al crear
            esta, esa deja de estar activa automáticamente — no se borra, solo pasa a ser historial.
          </p>
        )}

        <form onSubmit={guardar}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 160px' }}>
              <span style={labelStyle}>Fecha de inicio (lunes)</span>
              <input type="date" id="fecha-inicio" name="fecha-inicio" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ flex: '1 1 140px' }}>
              <span style={labelStyle}>Precio general</span>
              <input type="number" id="precio-general" name="precio-general" min="0" inputMode="decimal" value={precioGeneral} onChange={(e) => setPrecioGeneral(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ flex: '1 1 140px' }}>
              <span style={labelStyle}>Precio opcional</span>
              <input type="number" id="precio-opcional" name="precio-opcional" min="0" inputMode="decimal" value={precioOpcional} onChange={(e) => setPrecioOpcional(e.target.value)} style={inputStyle} />
            </label>
          </div>

          {DIAS_SEMANA.map((dia) => (
            <div key={dia} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
              <p style={{ fontWeight: 600, margin: '0 0 10px' }}>{DIA_LABEL[dia]}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select id={`${dia}-general`} name={`${dia}-general`} value={dias[dia].plato_general_id} onChange={(e) => actualizarDia(dia, 'plato_general_id', e.target.value)} style={inputStyle}>
                  <option value="">Elegí el plato general…</option>
                  {platos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
                <select id={`${dia}-opcional`} name={`${dia}-opcional`} value={dias[dia].plato_opcional_id} onChange={(e) => actualizarDia(dia, 'plato_opcional_id', e.target.value)} style={inputStyle}>
                  <option value="">Elegí el plato opcional…</option>
                  {platos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {error && (
            <p role="alert" style={{ color: 'var(--color-clay-dark)', fontSize: 14, marginBottom: 14 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={guardando}
            style={{ width: '100%', padding: '14px 0', fontSize: 16, fontWeight: 600, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-clay)', color: '#fff' }}
          >
            {guardando ? 'Creando semana…' : 'Crear y activar esta semana'}
          </button>
        </form>
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
