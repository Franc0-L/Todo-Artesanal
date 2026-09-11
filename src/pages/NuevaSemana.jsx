import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { DIA_LABEL, formatFecha } from '../lib/format'

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
const DIAS_POR_DEFECTO = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']

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
  return { plato_general: '', plato_opcional: '', notas_temperatura: '' }
}

export default function NuevaSemana() {
  const navigate = useNavigate()
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [semanaActivaActual, setSemanaActivaActual] = useState(null)

  const [fechaInicio, setFechaInicio] = useState(proximoLunes())
  const [precioGeneral, setPrecioGeneral] = useState('')
  const [precioOpcional, setPrecioOpcional] = useState('')
  const [diasHabilitados, setDiasHabilitados] = useState(
    Object.fromEntries(DIAS_ORDEN.map((d) => [d, DIAS_POR_DEFECTO.includes(d)]))
  )
  const [platos, setPlatos] = useState(Object.fromEntries(DIAS_ORDEN.map((d) => [d, diaVacio()])))

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/admin/login')
        return
      }
      setCargandoSesion(false)
    })
  }, [navigate])

  useEffect(() => {
    if (cargandoSesion) return
    supabase
      .from('semanas')
      .select('fecha_inicio')
      .eq('activa', true)
      .maybeSingle()
      .then(({ data }) => setSemanaActivaActual(data ?? null))
  }, [cargandoSesion])

  function actualizarPlato(dia, campo, valor) {
    setPlatos((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }))
  }

  function toggleDia(dia) {
    setDiasHabilitados((prev) => ({ ...prev, [dia]: !prev[dia] }))
  }

  async function guardar(e) {
    e.preventDefault()
    setError('')

    if (!fechaInicio || !precioGeneral || !precioOpcional) {
      setError('Completá la fecha de inicio y los dos precios.')
      return
    }

    const diasElegidos = DIAS_ORDEN.filter((d) => diasHabilitados[d])
    if (diasElegidos.length === 0) {
      setError('Elegí al menos un día para esta semana.')
      return
    }

    const faltante = diasElegidos.find(
      (d) => !platos[d].plato_general.trim() || !platos[d].plato_opcional.trim()
    )
    if (faltante) {
      setError(`Falta cargar el plato general u opcional de ${DIA_LABEL[faltante]}.`)
      return
    }

    const p_dias = diasElegidos.map((d, i) => ({
      dia_semana: d,
      fecha: sumarDias(fechaInicio, DIAS_ORDEN.indexOf(d)),
      plato_general: platos[d].plato_general.trim(),
      plato_opcional: platos[d].plato_opcional.trim(),
      notas_temperatura: platos[d].notas_temperatura.trim(),
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

  if (cargandoSesion) return null

  return (
    <div style={{ minHeight: '100%', padding: '28px 20px' }}>
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--color-border)',
          padding: '28px 26px',
        }}
      >
        <button
          onClick={() => navigate('/admin')}
          style={{ background: 'none', border: 'none', color: 'var(--color-ink-muted)', fontSize: 13, padding: 0, marginBottom: 14 }}
        >
          ← Volver al panel
        </button>

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
              <input
                type="date"
                id="fecha-inicio"
                name="fecha-inicio"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ flex: '1 1 140px' }}>
              <span style={labelStyle}>Precio general</span>
              <input
                type="number"
                id="precio-general"
                name="precio-general"
                min="0"
                inputMode="decimal"
                value={precioGeneral}
                onChange={(e) => setPrecioGeneral(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ flex: '1 1 140px' }}>
              <span style={labelStyle}>Precio opcional</span>
              <input
                type="number"
                id="precio-opcional"
                name="precio-opcional"
                min="0"
                inputMode="decimal"
                value={precioOpcional}
                onChange={(e) => setPrecioOpcional(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>

          {DIAS_ORDEN.map((dia) => (
            <div
              key={dia}
              style={{
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: '1px solid var(--color-border)',
                opacity: diasHabilitados[dia] ? 1 : 0.5,
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  id={`incluir-${dia}`}
                  name={`incluir-${dia}`}
                  checked={diasHabilitados[dia]}
                  onChange={() => toggleDia(dia)}
                />
                {DIA_LABEL[dia]}
              </label>

              {diasHabilitados[dia] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    id={`${dia}-general`}
                    name={`${dia}-general`}
                    placeholder="Plato general"
                    value={platos[dia].plato_general}
                    onChange={(e) => actualizarPlato(dia, 'plato_general', e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    id={`${dia}-opcional`}
                    name={`${dia}-opcional`}
                    placeholder="Plato opcional"
                    value={platos[dia].plato_opcional}
                    onChange={(e) => actualizarPlato(dia, 'plato_opcional', e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    id={`${dia}-notas`}
                    name={`${dia}-notas`}
                    placeholder="Notas de temperatura (opcional)"
                    value={platos[dia].notas_temperatura}
                    onChange={(e) => actualizarPlato(dia, 'notas_temperatura', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )}
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
            style={{
              width: '100%',
              padding: '14px 0',
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-clay)',
              color: '#fff',
            }}
          >
            {guardando ? 'Creando semana…' : 'Crear y activar esta semana'}
          </button>
        </form>
      </div>
    </div>
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
