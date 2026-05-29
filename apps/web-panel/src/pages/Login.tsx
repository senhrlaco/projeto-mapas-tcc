import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()

  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleLogin(e: React.FormEvent) {
    // previne o reload padrao do form
    e.preventDefault()
    setErro('')
    
    if (!usuario.trim() || !senha.trim()) {
      setErro('Preencha todos os campos')
      return
    }

    setIsLoading(true)

    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3333';
      
      // sanitiza usuario e envia credenciais
      const res = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usuario.trim(), password: senha }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro('Credenciais invalidas')
        return
      }

      localStorage.setItem('token', data.token)
      navigate('/')

    } catch {
      setErro('Nao foi possivel conectar ao servidor.')
    } finally {
      setIsLoading(false)
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

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
            <input
              type="text"
              placeholder="ex: lucas.mello"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              placeholder="Sua senha de acesso"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {erro && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100 mt-1">
              {erro}
            </div>
          )}

          {/* desabilita botao durante o loading */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 rounded-lg text-sm mt-1"
          >
            {isLoading ? 'Conectando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
