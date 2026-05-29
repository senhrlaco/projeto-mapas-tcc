import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Usuarios from './pages/Usuarios'
import Login from './pages/Login'

function PrivateRoute() {
  const token = localStorage.getItem('@Savez:token')
  if (!token) return <Navigate to="/login" replace />
  return <Outlet />
}

function Layout() {
  const navigate = useNavigate()

  function sair() {
    localStorage.removeItem('@Savez:token')
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">

      <aside className="w-56 bg-slate-900 text-white flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Savez Logistica</p>
          <p className="text-white font-semibold mt-0.5">Painel de Gestao</p>
        </div>

        <nav className="flex flex-col gap-1 p-3 mt-1">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              'px-3 py-2 rounded text-sm ' +
              (isActive
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white')
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/usuarios"
            className={({ isActive }) =>
              'px-3 py-2 rounded text-sm ' +
              (isActive
                ? 'bg-blue-600 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white')
            }
          >
            Usuarios
          </NavLink>
        </nav>

        <div className="mt-auto border-t border-slate-700">
          <button
            onClick={sair}
            className="w-full text-left px-5 py-4 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/usuarios" element={<Usuarios />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
