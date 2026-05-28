import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

type Usuario = {
  id: number
  nome: string
  login: string
  nivel: string
  ativo: boolean
}

export default function Usuarios() {
  const navigate = useNavigate()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [carregando, setCarregando] = useState(false)

  const [modalAberto, setModalAberto] = useState(false)
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<Usuario | null>(null)

  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [nivel, setNivel] = useState('Agente')

  // monta os headers padrao com o token do usuario logado
  function headersAutenticados(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
    }
  }

  // redireciona pro login quando o servidor recusar o acesso
  function tratarFalhaDeAutenticacao(status: number) {
    if (status === 401 || status === 403) {
      localStorage.clear()
      navigate('/login')
    }
  }

  // busca a lista de usuarios ao montar a pagina
  useEffect(() => {
    async function carregarUsuarios() {
      setCarregando(true)
      try {
        const res = await fetch(`${baseURL}/api/usuarios`, {
          headers: headersAutenticados(),
        })

        tratarFalhaDeAutenticacao(res.status)

        if (!res.ok) {
          alert('Nao foi possivel carregar os usuarios.')
          return
        }

        const data: Usuario[] = await res.json()
        setUsuarios(data)
      } catch {
        alert('Falha de conexao ao buscar usuarios.')
      } finally {
        setCarregando(false)
      }
    }

    carregarUsuarios()
  }, [])

  function abrirModalNovo() {
    setUsuarioEmEdicao(null)
    setNome('')
    setLogin('')
    setSenha('')
    setNivel('Agente')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setUsuarioEmEdicao(null)
    setNome('')
    setLogin('')
    setSenha('')
    setNivel('Agente')
  }

  function handleEditar(user: Usuario) {
    setUsuarioEmEdicao(user)
    setNome(user.nome)
    setLogin(user.login)
    setSenha('') // senha nunca trafega de volta pro front
    setNivel(user.nivel)
    setModalAberto(true)
  }

  async function handleExcluir(id: number) {
    if (!window.confirm('Tem certeza que quer excluir esse usuario?')) return

    setCarregando(true)
    try {
      const res = await fetch(`${baseURL}/api/usuarios/${id}`, {
        method: 'DELETE',
        headers: headersAutenticados(),
      })

      tratarFalhaDeAutenticacao(res.status)

      if (!res.ok) {
        alert('Nao foi possivel excluir o usuario.')
        return
      }

      // atualiza a lista local sem precisar re-buscar tudo
      setUsuarios((prev) => prev.filter((u) => u.id !== id))
    } catch {
      alert('Falha de conexao ao excluir usuario.')
    } finally {
      setCarregando(false)
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

    setCarregando(true)
    try {
      const ehEdicao = usuarioEmEdicao !== null

      const url = ehEdicao
        ? `${baseURL}/api/usuarios/${usuarioEmEdicao.id}`
        : `${baseURL}/api/usuarios`

      // na edicao, a senha so entra no payload se o campo foi preenchido
      const corpo: Record<string, unknown> = { nome, login, nivel }
      if (!ehEdicao) corpo.senha = senha

      const res = await fetch(url, {
        method: ehEdicao ? 'PUT' : 'POST',
        headers: headersAutenticados(),
        body: JSON.stringify(corpo),
      })

      tratarFalhaDeAutenticacao(res.status)

      if (!res.ok) {
        alert('Nao foi possivel salvar o usuario.')
        return
      }

      const usuarioSalvo: Usuario = await res.json()

      if (ehEdicao) {
        setUsuarios((prev) =>
          prev.map((u) => (u.id === usuarioSalvo.id ? usuarioSalvo : u))
        )
      } else {
        setUsuarios((prev) => [...prev, usuarioSalvo])
      }

      fecharModal()
    } catch {
      alert('Falha de conexao ao salvar usuario.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="p-8">
      {/* cabecalho da pagina */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Controle de acesso ao sistema</p>
        </div>
        <button
          onClick={abrirModalNovo}
          disabled={carregando}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          Novo Usuario
        </button>
      </div>

      {/* tabela de usuarios */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              <th className="px-5 py-3 font-semibold text-gray-600">Nome</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Usuario (Login)</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Nivel</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-5 py-3 font-semibold text-gray-600">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {carregando && usuarios.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-gray-400">
                  Carregando...
                </td>
              </tr>
            ) : (
              usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 text-gray-800 font-medium">{u.nome}</td>
                  <td className="px-5 py-3 text-gray-500">{u.login}</td>
                  <td className="px-5 py-3 text-gray-500">{u.nivel}</td>
                  <td className="px-5 py-3">
                    <span className={
                      'text-xs font-semibold px-2 py-1 rounded-full ' +
                      (u.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')
                    }>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditar(u)}
                        disabled={carregando}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold px-3 py-1.5 rounded"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleExcluir(u.id)}
                        disabled={carregando}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-xs font-semibold px-3 py-1.5 rounded"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* modal de criar/editar usuario */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* fundo escuro */}
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={fecharModal}
          />

          {/* caixa do modal */}
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            {/* titulo muda conforme o modo */}
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
                  <option value="ADM Master">ADM Master</option>
                  <option value="Gestor">Gestor</option>
                  <option value="Agente">Agente</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={fecharModal}
                disabled={carregando}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={carregando}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg"
              >
                {carregando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
