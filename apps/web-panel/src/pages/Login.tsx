import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()

  // campos do form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [carregando, setCarregando] = useState(false)

  // bate na api pra logar
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCarregando(true)

    try {
      const res = await fetch('http://localhost:3333/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert('Credenciais invalidas')
        return
      }

      // salva o token e manda pro dashboard
      localStorage.setItem('token', data.token)
      navigate('/')

    } catch {
      alert('Nao foi possivel conectar ao servidor.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white shadow-md rounded-lg p-8 w-full max-w-sm">

        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Savez Logistica</p>
          <h1 className="text-xl font-bold text-gray-800">Painel de Gestao</h1>
          <p className="text-sm text-gray-500 mt-1">Acesso restrito a usuarios cadastrados</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <input
              type="text"
              placeholder="ex: lucas.mello"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              placeholder="Sua senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 rounded-lg text-sm mt-1"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
