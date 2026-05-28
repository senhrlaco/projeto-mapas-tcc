import { useState } from 'react'

// tipo do usuario da tabela
type Usuario = {
  id: number
  nome: string
  login: string
  nivel: string
  ativo: boolean
}

// mock provisorio, depois vamos ligar na API
const dadosIniciais: Usuario[] = [
  { id: 1, nome: 'Lucas Menezes', login: 'lucas.menezes', nivel: 'ADM Master', ativo: true },
  { id: 2, nome: 'Rafaela Costa', login: 'rafaela.costa', nivel: 'Gestor',     ativo: true },
  { id: 3, nome: 'Bruno Alves',   login: 'bruno.alves',   nivel: 'Agente',     ativo: false },
]

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(dadosIniciais)

  // abre e fecha o modal
  const [modalAberto, setModalAberto] = useState(false)

  // guarda qual usuario ta sendo editado (null = modo criacao)
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<Usuario | null>(null)

  // campos do form
  const [nome, setNome] = useState('')
  const [login, setLogin] = useState('')
  const [senha, setSenha] = useState('')
  const [nivel, setNivel] = useState('Agente')

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

  // abre o modal ja preenchido com os dados do usuario
  function handleEditar(user: Usuario) {
    alert(`Editando: ${user.nome} (${user.login})`)
    setUsuarioEmEdicao(user)
    setNome(user.nome)
    setLogin(user.login)
    setSenha('') // senha nao fica exposta
    setNivel(user.nivel)
    setModalAberto(true)
  }

  // pede confirmacao antes de remover da lista
  function handleExcluir(id: number) {
    if (window.confirm('Tem certeza que quer excluir esse usuario?')) {
      // TODO: chamar DELETE na API
      alert('Usuario removido com sucesso (dados temporarios, nao persiste)')
      setUsuarios(usuarios.filter((u) => u.id !== id))
    }
  }

  function salvar() {
    if (!nome || !login) {
      alert('Nome e usuario sao obrigatorios')
      return
    }

    if (usuarioEmEdicao) {
      // TODO: chamar PUT na API
      setUsuarios(usuarios.map((u) =>
        u.id === usuarioEmEdicao.id ? { ...u, nome, login, nivel } : u
      ))
      alert(`Mock: usuario "${login}" atualizado`)
    } else {
      if (!senha) {
        alert('Senha e obrigatoria para novo usuario')
        return
      }
      // TODO: chamar POST na API
      const novo: Usuario = {
        id: Date.now(),
        nome,
        login,
        nivel,
        ativo: true,
      }
      setUsuarios([...usuarios, novo])
      alert(`Mock: usuario "${login}" cadastrado`)
    }

    fecharModal()
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
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
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
            {usuarios.map((u) => (
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
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleExcluir(u.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
