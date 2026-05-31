import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import useSWR from 'swr'
import { fetcher } from '../lib/fetcher'
import { api } from '../services/api'
type Usuario = {
  id: string
  nome: string
  username: string
  nivel: string
}

export default function Usuarios() {
  const navigate = useNavigate()

  const {
    data: usuarios = [],
    isLoading,
    mutate,
    error,
  } = useSWR<Usuario[]>('/usuarios', fetcher)

  const [salvando, setSalvando] = useState(false)

  const [modalAberto, setModalAberto] = useState(false)
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false)
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<Usuario | null>(null)

  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [nivel, setNivel] = useState('AGENTE')

  let loggedUser: any = null
  const token = localStorage.getItem('@Savez:token')
  if (token) {
    try {
      loggedUser = JSON.parse(atob(token.split('.')[1]))
    } catch {}
  }

  // valida hierarquia por sistema de pesos
  const PESOS_RBAC: Record<string, number> = {
    'ADM_MASTER': 100,
    'GESTOR': 50,
    'AGENTE': 10,
  }
  const pesoLogado = PESOS_RBAC[loggedUser?.nivel || 'AGENTE'] || 0

  if (error && ((error as any).status === 401 || (error as any).status === 403)) {
    localStorage.removeItem('@Savez:token')
    // corrige warning do react router com componente navigate
    return <Navigate to="/login" replace />
  }

  function tratarFalhaDeAutenticacao(status: number) {
    if (status === 401 || status === 403) {
      localStorage.removeItem('@Savez:token')
      navigate('/login')
    }
  }

  function abrirModalNovo() {
    setUsuarioEmEdicao(null)
    setNome('')
    setLogin('')
    setSenha('')
    setNivel('AGENTE')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setModalSenhaAberto(false)
    setUsuarioEmEdicao(null)
    setNome('')
    setLogin('')
    setSenha('')
    setNivel('AGENTE')
  }

  function handleEditar(user: Usuario) {
    setUsuarioEmEdicao(user)
    setNome(user.nome)
    setLogin(user.username)
    setSenha('') // senha nunca volta pro front
    setNivel(user.nivel)
    setModalAberto(true)
  }

  async function handleExcluir(id: string) {
    if (!window.confirm('Tem certeza que quer excluir esse usuario?')) return

    setSalvando(true)
    try {
      await api.delete(`/usuarios/${id}`)

      mutate()
    } catch (err: any) {
      tratarFalhaDeAutenticacao(err.response?.status)
      alert('Falha de conexao ao excluir usuario.')
    } finally {
      setSalvando(false)
    }
  }

  function abrirModalSenha(user: Usuario) {
    setUsuarioEmEdicao(user)
    setNovaSenha('')
    setModalSenhaAberto(true)
  }

  async function handleSalvarNovaSenha() {
    if (!novaSenha || novaSenha.length < 4) {
      alert('Digite uma senha valida (minimo 4 caracteres)')
      return
    }
    if (!usuarioEmEdicao) return
    
    setSalvando(true)
    try {
      await api.patch(`/usuarios/${usuarioEmEdicao.id}/senha`, { novaSenha })
      
      alert('Senha alterada com sucesso!')
      setModalSenhaAberto(false)
      setUsuarioEmEdicao(null)
    } catch (err: any) {
      tratarFalhaDeAutenticacao(err.response?.status)
      alert('Falha de conexao ao alterar senha.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvar() {
    if (!nome || !login) {
      alert('Nome e usuario sao obrigatorios')
      return
    }

    if (!usuarioEmEdicao && !senha) {
      alert('Senha e obrigatoria para novo usuario')
      return
    }

    setSalvando(true)
    try {
      const ehEdicao = usuarioEmEdicao !== null

      const url = ehEdicao
        ? `/usuarios/${usuarioEmEdicao.id}`
        : `/usuarios`

      // traduz estados locais para os campos esperados pelo servidor
      const corpo: Record<string, unknown> = { name: nome, email: login, nivel }
      if (!ehEdicao) corpo.password = senha

      if (ehEdicao) {
        await api.put(url, corpo)
      } else {
        await api.post(url, corpo)
      }

      mutate()
      fecharModal()
    } catch (err: any) {
      tratarFalhaDeAutenticacao(err.response?.status)
      alert('Falha de conexao ao salvar usuario.')
    } finally {
      setSalvando(false)
    }
  }

  const bloqueado = salvando || isLoading

  if (loggedUser?.nivel === 'AGENTE') {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="bg-red-50 text-red-600 p-6 rounded-lg text-center shadow border border-red-100">
          <h2 className="text-lg font-bold mb-2">Acesso Negado</h2>
          <p className="text-sm">Seu nivel de acesso nao permite visualizar o controle de usuarios.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Controle de acesso ao sistema</p>
        </div>
        {loggedUser?.nivel !== 'AGENTE' && (
          <button
            onClick={abrirModalNovo}
            disabled={bloqueado}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            Novo Usuario
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-5 py-3 font-semibold text-gray-600">Nome</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Usuario (Login)</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Nivel</th>
              {loggedUser?.nivel !== 'AGENTE' && (
                <th className="px-5 py-3 font-semibold text-gray-600">Acoes</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && usuarios.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-sm text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 text-gray-800 font-medium">{u.nome}</td>
                  <td className="px-5 py-3 text-gray-500">{u.username}</td>
                  <td className="px-5 py-3 text-gray-500">{u.nivel}</td>
                  {loggedUser?.nivel !== 'AGENTE' && (
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {/* oculta acoes para niveis inferiores */}
                        {(loggedUser?.id === u.id || pesoLogado > (PESOS_RBAC[u.nivel] || 0)) && (
                          <button
                            onClick={() => handleEditar(u)}
                            disabled={bloqueado}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold px-3 py-1.5 rounded"
                          >
                            Editar
                          </button>
                        )}
                        
                        {loggedUser?.nivel === 'ADM_MASTER' && (
                          <button
                            onClick={() => abrirModalSenha(u)}
                            disabled={bloqueado}
                            className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-400 text-white text-xs font-semibold px-3 py-1.5 rounded"
                          >
                            Alterar Senha
                          </button>
                        )}

                        {((loggedUser?.nivel === 'ADM_MASTER' && u.id !== loggedUser?.id) || 
                          (loggedUser?.nivel === 'GESTOR' && u.nivel === 'AGENTE')) && (
                          <button
                            onClick={() => handleExcluir(u.id)}
                            disabled={bloqueado}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-semibold px-3 py-1.5 rounded"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={fecharModal}
          />

          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              {usuarioEmEdicao ? 'Editar Usuario' : 'Novo Usuario'}
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario de Acesso</label>
                <input
                  type="text"
                  placeholder="ex: lucas.menezes"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* campo de senha so aparece na criacao */}
              {!usuarioEmEdicao && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha Inicial</label>
                  <input
                    type="password"
                    placeholder="Senha inicial do colaborador"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nivel de Acesso</label>
                <select
                  value={nivel}
                  onChange={(e) => setNivel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {pesoLogado > 50 && <option value="ADM_MASTER">ADM_MASTER</option>}
                  <option value="GESTOR">GESTOR</option>
                  <option value="AGENTE">AGENTE</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={fecharModal}
                disabled={salvando}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalSenhaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={fecharModal}
          />

          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">
              Alterar Senha - {usuarioEmEdicao?.nome}
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova Senha</label>
                <input
                  type="password"
                  placeholder="Digite a nova senha"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={fecharModal}
                disabled={salvando}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarNovaSenha}
                disabled={salvando}
                className="px-4 py-2 text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-400 rounded-lg"
              >
                {salvando ? 'Salvando...' : 'Atualizar Senha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
