import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { DIA_LABEL, formatFecha } from '../lib/format'

const OPCIONES = [
  { valor: 'general', etiqueta: 'General' },
  { valor: 'opcional', etiqueta: 'Opcional' },
  { valor: 'no_come', etiqueta: 'No como este día' },
]

export default function ClientOrder() {
  const { token } = useParams()
  const [estado, setEstado] = useState('cargando') // cargando | listo | no_encontrado | error
  const [dias, setDias] = useState([])
  const [nombre, setNombre] = useState('')
  const [semanaInicio, setSemanaInicio] = useState(null)
  const [guardando, setGuardando] = useState({})

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data, error } = await supabase.rpc('get_client_menu', { p_token: token })

      if (!activo) return

      if (error) {
        console.error(error)
        setEstado('error')
        return
      }

      if (!data || data.length === 0) {
        setEstado('no_encontrado')
        return
      }

      setNombre(data[0].cliente_nombre)
      setSemanaInicio(data[0].semana_inicio)
      setDias(
        data.map((fila) => ({
          diaMenuId: fila.dia_menu_id,
          diaSemana: fila.dia_semana,
          fecha: fila.fecha,
          platoGeneral: fila.plato_general,
          platoOpcional: fila.plato_opcional,
          notasTemperatura: fila.notas_temperatura,
          eleccion: fila.eleccion_actual,
        }))
      )
      setEstado('listo')
    }

    cargar()
    return () => {
      activo = false
    }
  }, [token])

  async function elegir(diaMenuId, tipo) {
    setGuardando((prev) => ({ ...prev, [diaMenuId]: true }))
    setDias((prev) =>
      prev.map((d) => (d.diaMenuId === diaMenuId ? { ...d, eleccion: tipo } : d))
    )

    const { error } = await supabase.rpc('submit_order', {
      p_token: token,
      p_dia_menu_id: diaMenuId,
      p_tipo: tipo,
    })

    if (error) {
      console.error(error)
    }
    setGuardando((prev) => ({ ...prev, [diaMenuId]: false }))
  }

  if (estado === 'cargando') {
    return <Centrado>Cargando tu menú de la semana…</Centrado>
  }

  if (estado === 'no_encontrado') {
    return (
      <Centrado>
        No encontramos tu menú. Si el link no funciona, escribile a Todo Artesanal por
        WhatsApp para que te lo reenvíen.
      </Centrado>
    )
  }

  if (estado === 'error') {
    return <Centrado>Hubo un problema para cargar el menú. Probá de nuevo en un rato.</Centrado>
  }

  return (
    <div style={{ minHeight: '100%', padding: '28px 16px' }}>
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--color-border)',
          padding: '28px 24px',
        }}
      >
        <p style={{ margin: '0 0 6px', color: 'var(--color-ink-muted)', fontSize: 15 }}>
          Semana del {formatFecha(semanaInicio)}
        </p>
        <h1 style={{ fontSize: 26, marginBottom: 22 }}>Hola, {nombre}</h1>

        {dias.map((dia) => (
          <div
            key={dia.diaMenuId}
            style={{
              marginBottom: 22,
              paddingBottom: 22,
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <p style={{ fontSize: 19, fontWeight: 600, margin: '0 0 4px' }}>
              {DIA_LABEL[dia.diaSemana]}
            </p>
            <p style={{ margin: '0 0 4px', color: 'var(--color-ink-muted)', fontSize: 15 }}>
              General: {dia.platoGeneral}
            </p>
            <p style={{ margin: '0 0 12px', color: 'var(--color-ink-muted)', fontSize: 15 }}>
              Opcional: {dia.platoOpcional}
            </p>
            {dia.notasTemperatura && (
              <p
                style={{
                  margin: '0 0 12px',
                  color: 'var(--color-olive-dark)',
                  fontSize: 14,
                }}
              >
                {dia.notasTemperatura}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {OPCIONES.map((op) => {
                const seleccionado = dia.eleccion === op.valor
                return (
                  <button
                    key={op.valor}
                    onClick={() => elegir(dia.diaMenuId, op.valor)}
                    disabled={guardando[dia.diaMenuId]}
                    style={{
                      padding: '14px 16px',
                      fontSize: 17,
                      borderRadius: 'var(--radius-md)',
                      border: seleccionado
                        ? '2px solid var(--color-clay)'
                        : '1px solid var(--color-border)',
                      background: seleccionado ? 'var(--color-clay-bg)' : 'var(--color-surface)',
                      color: seleccionado ? 'var(--color-clay-dark)' : 'var(--color-ink)',
                      fontWeight: seleccionado ? 600 : 400,
                      textAlign: 'left',
                    }}
                  >
                    {seleccionado ? '✓ ' : ''}
                    {op.etiqueta}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <p style={{ textAlign: 'center', color: 'var(--color-ink-muted)', fontSize: 14 }}>
          Cada elección se guarda sola apenas la tocás. Podés volver a este mismo link y
          cambiarla cuando quieras.
        </p>
      </div>
    </div>
  )
}

function Centrado({ children }) {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        color: 'var(--color-ink-muted)',
        fontSize: 17,
      }}
    >
      <p style={{ maxWidth: 320 }}>{children}</p>
    </div>
  )
}
