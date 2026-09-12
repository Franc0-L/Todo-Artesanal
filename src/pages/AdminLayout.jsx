import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const NAV_ITEMS = [
  { to: '/admin', label: 'Pedidos', end: true },
  { to: '/admin/nueva-semana', label: 'Nueva semana' },
  { to: '/admin/platos', label: 'Platos' },
  { to: '/admin/clientes', label: 'Clientes' },
]

export const cardStyle = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)',
  border: '1px solid var(--color-border)',
  padding: '28px 26px',
  marginBottom: 24,
}

export default function AdminLayout({ children }) {
  const navigate = useNavigate()
  const [cargandoSesion, setCargandoSesion] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate('/admin/login')
        return
      }
      setCargandoSesion(false)
    })
  }, [navigate])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  if (cargandoSesion) return null

  return (
    <div style={{ minHeight: '100%' }}>
      <header style={headerStyle}>
        <div style={headerInnerStyle}>
          <span style={brandStyle}>Todo Artesanal</span>
          <nav style={navStyle}>
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} style={({ isActive }) => navLinkStyle(isActive)}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={cerrarSesion} style={logoutStyle}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main style={{ padding: '28px 20px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  )
}

const headerStyle = {
  background: 'var(--color-surface)',
  borderBottom: '1px solid var(--color-border)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
}

const headerInnerStyle = {
  maxWidth: 960,
  margin: '0 auto',
  padding: '14px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
}

const brandStyle = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 19,
  color: 'var(--color-clay-dark)',
  marginRight: 'auto',
  paddingRight: 12,
}

const navStyle = {
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
}

function navLinkStyle(isActive) {
  return {
    padding: '7px 14px',
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    color: isActive ? '#fff' : 'var(--color-ink-muted)',
    background: isActive ? 'var(--color-clay)' : 'transparent',
    whiteSpace: 'nowrap',
  }
}

const logoutStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--color-ink-muted)',
  fontSize: 13,
  whiteSpace: 'nowrap',
  marginLeft: 12,
}
