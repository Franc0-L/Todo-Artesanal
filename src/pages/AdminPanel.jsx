import { useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { DIA_LABEL, formatFecha, formatMonto } from '../lib/format'

const CICLO = [null, 'general', 'opcional', 'no_come']

const ETIQUETA_CELDA = {
  general: 'G',
  opcional: 'O',
  no_come: 'N',
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const [cargandoSesion, setCargandoSesion] = useState(true)
  const [semana, setSemana] = useState(null)
  const [dias, setDias] = useState([])
  const [clientes, setClientes] = useState([])
  const [pedidos, setPedidos] = useState({}) // { [clienteId]: { [diaMenuId]: { tipo_menu, monto } } }
  const [copiado, setCopiado] = useState(null)
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

  const cargarDatos = useCallback(async () => {
    setError('')
    const { data: semanaActiva, error: errorSemana } = await supabase
      .from('semanas')
      .select('*')
      .eq('activa', true)
      .maybeSingle()

    if (errorSemana) {
      setError('No pudimos cargar los pedidos. Probá de nuevo en unos minutos.')
      return
    }

    if (!semanaActiva) {
      setSemana(null)
      return
    }
    setSemana(semanaActiva)

    const [diasResult, clientesResult, pedidosResult] = await Promise.all([
      supabase
        .from('dias_menu')
        .select('*')
        .eq('semana_id', semanaActiva.id)
        .order('fecha'),
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('vista_pedidos_semana').select('*').eq('semana_id', semanaActiva.id),
    ])

    if (diasResult.error || clientesResult.error || pedidosResult.error) {
      setError('No pudimos cargar los pedidos. Probá de nuevo en unos minutos.')
      return
    }

    const diasData = diasResult.data
    const clientesData = clientesResult.data
    const pedidosData = pedidosResult.data
    setDias(diasData ?? [])
    setClientes(clientesData ?? [])

    const mapa = {}
    for (const p of pedidosData ?? []) {
      mapa[p.cliente_id] = mapa[p.cliente_id] ?? {}
      mapa[p.cliente_id][p.dia_menu_id] = { tipo_menu: p.tipo_menu, monto: p.monto }
    }
    setPedidos(mapa)
  }, [])

  useEffect(() => {
    if (cargandoSesion) return
    cargarDatos()

    const canal = supabase
      .channel('pedidos-en-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        cargarDatos()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [cargandoSesion, cargarDatos])

  function calcularMonto(cliente, tipo) {
    if (tipo === 'no_come' || !tipo) return 0
    if (tipo === 'general') return cliente.precio_general_especial ?? semana.precio_general
    return cliente.precio_opcional_especial ?? semana.precio_opcional
  }

  async function cambiarCelda(cliente, diaMenuId) {
    const actual = pedidos[cliente.id]?.[diaMenuId]?.tipo_menu ?? null
    const siguiente = CICLO[(CICLO.indexOf(actual) + 1) % CICLO.length]

    // actualización optimista, para que se sienta instantáneo
    setPedidos((prev) => {
      const copia = { ...prev, [cliente.id]: { ...prev[cliente.id] } }
      if (siguiente === null) {
        delete copia[cliente.id][diaMenuId]
      } else {
        copia[cliente.id][diaMenuId] = { tipo_menu: siguiente, monto: calcularMonto(cliente, siguiente) }
      }
      return copia
    })

    let result
    if (siguiente === null) {
      result = await supabase.from('pedidos').delete().match({ cliente_id: cliente.id, dia_menu_id: diaMenuId })
    } else {
      result = await supabase
        .from('pedidos')
        .upsert(
          { cliente_id: cliente.id, dia_menu_id: diaMenuId, tipo_menu: siguiente },
          { onConflict: 'cliente_id,dia_menu_id' }
        )
    }
    if (result.error) {
      setError('No pudimos guardar el cambio. Volvé a intentarlo.')
      cargarDatos()
    }
  }

  async function copiarLink(cliente) {
    const url = `${window.location.origin}/menu/${cliente.token}`
    await navigator.clipboard.writeText(url)
    setCopiado(cliente.id)
    setTimeout(() => setCopiado(null), 1500)
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  if (cargandoSesion) return null

  if (!semana) {
    return (
      <Contenedor onCerrarSesion={cerrarSesion}>
        <p style={{ color: 'var(--color-ink-muted)', marginBottom: 16 }}>
          No hay ninguna semana activa todavía.
        </p>
        <Link to="/admin/nueva-semana" style={primaryLinkStyle}>
          Cargar la primera semana
        </Link>
      </Contenedor>
    )
  }

  const totalPorCliente = (clienteId) =>
    Object.values(pedidos[clienteId] ?? {}).reduce((acc, p) => acc + Number(p.monto), 0)

  const totalRacionesPorDia = (diaMenuId, tipo) =>
    clientes.filter((c) => pedidos[c.id]?.[diaMenuId]?.tipo_menu === tipo).length

  const totalSemana = clientes.reduce((acc, c) => acc + totalPorCliente(c.id), 0)

  return (
    <Contenedor onCerrarSesion={cerrarSesion}>
      {error && <p role="alert" style={{ color: 'var(--color-clay-dark)' }}>{error}</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p style={{ color: 'var(--color-ink-muted)', fontSize: 14, margin: '0 0 4px' }}>
            Semana del {formatFecha(semana.fecha_inicio)}
          </p>
          <h1 style={{ fontSize: 24, margin: 0 }}>Pedidos de la semana</h1>
        </div>
        <Link to="/admin/nueva-semana" style={primaryLinkStyle}>
          Cargar próxima semana
        </Link>
      </div>
      <div style={{ marginBottom: 18 }} />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={thStyle}>Cliente</th>
              {dias.map((d) => (
                <th key={d.id} style={{ ...thStyle, textAlign: 'center' }}>
                  {DIA_LABEL[d.dia_semana].slice(0, 3)}
                </th>
              ))}
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{cliente.nombre}</td>
                {dias.map((dia) => {
                  const tipo = pedidos[cliente.id]?.[dia.id]?.tipo_menu ?? null
                  return (
                    <td key={dia.id} style={{ ...tdStyle, textAlign: 'center' }}>
                      <button onClick={() => cambiarCelda(cliente, dia.id)} style={celdaStyle(tipo)}>
                        {tipo ? ETIQUETA_CELDA[tipo] : '–'}
                      </button>
                    </td>
                  )
                })}
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                  {formatMonto(totalPorCliente(cliente.id))}
                </td>
                <td style={tdStyle}>
                  <button onClick={() => copiarLink(cliente)} style={linkBtnStyle}>
                    {copiado === cliente.id ? '¡Copiado!' : 'Copiar enlace'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ ...tdStyle, color: 'var(--color-ink-muted)', fontSize: 13 }}>
                Raciones a cocinar
              </td>
              {dias.map((dia) => (
                <td key={dia.id} style={{ ...tdStyle, textAlign: 'center', fontSize: 13, color: 'var(--color-ink-muted)' }}>
                  {totalRacionesPorDia(dia.id, 'general')}G / {totalRacionesPorDia(dia.id, 'opcional')}O
                </td>
              ))}
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700 }}>
                {formatMonto(totalSemana)}
              </td>
              <td style={tdStyle}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 20, fontSize: 13, color: 'var(--color-ink-muted)' }}>
        <Leyenda color="var(--color-sage-bg)" texto="G / O confirmado" />
        <Leyenda color="var(--color-muted-bg)" texto="N no come" />
        <Leyenda color="transparent" borde texto="– sin responder" />
      </div>
    </Contenedor>
  )
}

function Contenedor({ children, onCerrarSesion }) {
  return (
    <div style={{ minHeight: '100%', padding: '28px 20px' }}>
      <div
        style={{
          maxWidth: 920,
          margin: '0 auto',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--color-border)',
          padding: '28px 26px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button
            onClick={onCerrarSesion}
            style={{ background: 'none', border: 'none', color: 'var(--color-ink-muted)', fontSize: 13 }}
          >
            Cerrar sesión
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Leyenda({ color, texto, borde }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          background: color,
          border: borde ? '1px solid var(--color-border)' : 'none',
        }}
      />
      {texto}
    </span>
  )
}

function celdaStyle(tipo) {
  const fondo =
    tipo === 'no_come'
      ? 'var(--color-muted-bg)'
      : tipo
      ? 'var(--color-sage-bg)'
      : 'transparent'
  const color = tipo === 'no_come' ? 'var(--color-ink-muted)' : tipo ? 'var(--color-sage)' : 'var(--color-ink-muted)'
  return {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: tipo ? 'none' : '1px solid var(--color-border)',
    background: fondo,
    color,
    fontSize: 14,
    fontWeight: 600,
  }
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

const primaryLinkStyle = {
  display: 'inline-block',
  padding: '9px 16px',
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-clay)',
  color: '#fff',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
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
