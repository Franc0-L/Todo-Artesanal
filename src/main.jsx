import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ClientOrder from './pages/ClientOrder.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import NuevaSemana from './pages/NuevaSemana.jsx'
import Platos from './pages/Platos.jsx'
import Clientes from './pages/Clientes.jsx'
import './styles/tokens.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/menu/:token" element={<ClientOrder />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/nueva-semana" element={<NuevaSemana />} />
        <Route path="/admin/platos" element={<Platos />} />
        <Route path="/admin/clientes" element={<Clientes />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
