import { useState } from 'react'
import { api } from '../services/api'

export default function Login() {

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
      // salva o token para persistencia entre abas
      const response = await api.post('/auth/login', { login: usuario.trim(), senha })
      const token = response.data.token
      localStorage.setItem('@Savez:token', token)

      // forca navegacao completa para que o PrivateRoute releia o localStorage
      window.location.href = '/'

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
              placeholder="ex: usuario123"
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
