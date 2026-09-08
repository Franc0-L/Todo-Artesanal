import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(false)
    if (error) {
      setError('Usuario o contraseña incorrectos.')
      return
    }
    navigate('/admin')
  }

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <form
        onSubmit={enviar}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--color-border)',
          padding: '32px 28px',
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 20 }}>Todo Artesanal</h1>

        <label style={{ display: 'block', marginBottom: 14 }}>
          <span style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 20 }}>
          <span style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        {error && (
          <p style={{ color: 'var(--color-clay-dark)', fontSize: 14, marginBottom: 14 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={cargando}
          style={{
            width: '100%',
            padding: '13px 0',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--color-clay)',
            color: '#fff',
          }}
        >
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '11px 12px',
  fontSize: 16,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
}
