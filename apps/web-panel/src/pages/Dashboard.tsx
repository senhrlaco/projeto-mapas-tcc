import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Map, Marker, Popup } from 'react-map-gl/mapbox'
import useSWR from 'swr'
import 'mapbox-gl/dist/mapbox-gl.css'
import { fetcher } from '../lib/fetcher'

import { api } from '../services/api'
type Visita = {
  id: string
  status: string
  distanceToDest: number
  serverTimestamp: string
  user: { name: string }
  client: { name: string }
}

type Cliente = {
  id: string
  name: string
  address?: string
  latitude: number
  longitude: number
  statusOperacional?: string
}

type MarkerSelecionado = Cliente | null

type RespostaPing = {
  status: string
  totalUsuarios: number
}

export default function Dashboard() {
  const navigate = useNavigate()

  const [selectedMarker, setSelectedMarker] = useState<MarkerSelecionado>(null)

  let loggedUser: any = null
  const token = localStorage.getItem('@Savez:token')
  if (token) {
    try {
      loggedUser = JSON.parse(atob(token.split('.')[1]))
    } catch {}
  }

  const [modalClienteAberto, setModalClienteAberto] = useState(false)
  const [nomeCliente, setNomeCliente] = useState('')
  const [enderecoCliente, setEnderecoCliente] = useState('')
  const [erroGeocodificacao, setErroGeocodificacao] = useState('')
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  const [suggestions, setSuggestions] = useState<any[]>([])
  const [selectedCoords, setSelectedCoords] = useState<[number, number] | null>(null)

  const [viewState, setViewState] = useState({
    longitude: -43.1772,
    latitude: -22.9027,
    zoom: 11,
  })

  const { data: ping, error: pingError } = useSWR<RespostaPing>('/ping', fetcher)

  const {
    data: clientes = [],
    mutate: mutateClientes,
    error: clientesError,
  } = useSWR<Cliente[]>('/clientes', fetcher)

  const { data: visitas = [], error: visitasError } = useSWR<Visita[]>(
    '/visitas',
    fetcher,
    { refreshInterval: 10_000 },
  )

  const erros = [pingError, clientesError, visitasError]
  const erroDeAutenticacao = erros.some(
    (e) => e && ((e as Error & { status?: number }).status === 401 || (e as Error & { status?: number }).status === 403),
  )
  if (erroDeAutenticacao) {
    localStorage.removeItem('@Savez:token')
    // corrige warning do react router com componente navigate
    return <Navigate to="/login" replace />
  }



  function abrirModalCliente() {
    // previne renderizacao do botao de cadastro de cliente para agentes
    if (loggedUser?.nivel === 'AGENTE') return
    setNomeCliente('')
    setEnderecoCliente('')
    setErroGeocodificacao('')
    setSuggestions([])
    setSelectedCoords(null)
    setModalClienteAberto(true)
  }

  function fecharModalCliente() {
    setModalClienteAberto(false)
    setNomeCliente('')
    setEnderecoCliente('')
    setErroGeocodificacao('')
    setSuggestions([])
    setSelectedCoords(null)
  }

  // busca enderecos direto na api do mapbox
  async function buscarSugestoes(texto: string) {
    setEnderecoCliente(texto)
    setSelectedCoords(null)
    if (erroGeocodificacao) setErroGeocodificacao('')

    if (texto.length < 3) {
      setSuggestions([])
      return
    }

    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(texto)}.json?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}&autocomplete=true&types=address,poi&country=br&limit=5`
      )
      const data = await res.json()
      setSuggestions(data.features || [])
    } catch {
      // ignora erro silencioso no typeahead
    }
  }

  async function salvarCliente() {
    if (!nomeCliente || !enderecoCliente) {
      setErroGeocodificacao('Preencha o nome e o endereco do cliente.')
      return
    }

    // trava envio sem coordenada valida
    if (!selectedCoords) {
      setErroGeocodificacao('Selecione um endereco valido da lista.')
      return
    }

    setErroGeocodificacao('')
    setSalvandoCliente(true)

    try {
      const [lng, lat] = selectedCoords

      await api.post('/clientes', {
        name: nomeCliente,
        address: enderecoCliente,
        latitude: lat,
        longitude: lng,
      })

      mutateClientes()
      fecharModalCliente()
    } catch (err: any) {
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        localStorage.removeItem('@Savez:token')
        navigate('/login')
        return
      }
      setErroGeocodificacao('Falha ao cadastrar cliente. Verifique a rede e tente novamente.')
    } finally {
      setSalvandoCliente(false)
    }
  }

  return (
    <div className="p-8">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Visao Geral</h1>
          <p className="text-sm text-gray-500 mt-1">Resumo das operacoes de campo</p>
        </div>
        {loggedUser?.nivel !== 'AGENTE' && (
          <button
            onClick={abrirModalCliente}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            Cadastrar Cliente
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-5">
          <p className="text-sm text-gray-500">Usuarios Cadastrados</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{ping?.totalUsuarios ?? '--'}</p>
          <p className="text-xs text-gray-400 mt-1">registros ativos no banco</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-5">
          <p className="text-sm text-gray-500">Visitas Recentes</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{visitas.length}</p>
          <p className="text-xs text-gray-400 mt-1">ultimas 50 registradas</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-5">
          <p className="text-sm text-gray-500">Pontos no Mapa</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{clientes.length}</p>
          <p className="text-xs text-gray-400 mt-1">clientes cadastrados</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Mapa de Visitas</p>
        </div>

        <div className="min-h-[75vh] w-full overflow-hidden">
          <Map
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
            style={{ width: '100%', height: '600px' }}
          >
            {clientes.map((c) => {
              const lat = Number(c.latitude)
              const lng = Number(c.longitude)
              if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null
              return (
                <Marker
                  key={c.id}
                  longitude={lng}
                  latitude={lat}
                  color="#2563eb"
                  onClick={(e) => {
                    // impede propagacao do clique para o mapa
                    e.originalEvent.stopPropagation()
                    setSelectedMarker(c)
                  }}
                />
              )
            })}

            {selectedMarker && (() => {
              const lat = Number(selectedMarker.latitude)
              const lng = Number(selectedMarker.longitude)
              if (isNaN(lat) || isNaN(lng)) return null
              return (
                <Popup
                  longitude={lng}
                  latitude={lat}
                  onClose={() => setSelectedMarker(null)}
                  closeOnClick={false}
                  anchor="bottom"
                >
                  <div className="text-sm min-w-[200px]">
                    <div className="flex flex-col border-b border-gray-100 pb-2 mb-2">
                      <p className="font-semibold text-gray-800">{selectedMarker.name}</p>
                      {/* renderiza badge de status no mapa */}
                      <div className="mt-1">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                          selectedMarker.statusOperacional === 'FALTA_DOCUMENTOS'
                            ? 'bg-red-100 text-red-800'
                            : selectedMarker.statusOperacional === 'PENDENTE' || !selectedMarker.statusOperacional
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {selectedMarker.statusOperacional || 'PENDENTE'}
                        </span>
                      </div>
                    </div>
                    {selectedMarker.address && (
                      <p className="text-gray-500 text-xs mb-3">{selectedMarker.address}</p>
                    )}

                    <div className="mb-3 border-t border-gray-100 pt-3 mt-1">
                      <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Status Operacional</label>
                      <select
                        className="w-full border border-gray-200 rounded text-xs py-1.5 px-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                        value={selectedMarker.statusOperacional || 'PENDENTE'}
                        onChange={async (e) => {
                          const novoStatus = e.target.value
                          const clienteAtualizado = { ...selectedMarker, statusOperacional: novoStatus }
                          
                          setSelectedMarker(clienteAtualizado)
                          mutateClientes(clientes.map(c => c.id === clienteAtualizado.id ? clienteAtualizado : c), false)

                          try {
                            await api.patch(`/clientes/${clienteAtualizado.id}/status`, {
                              statusOperacional: novoStatus
                            })

                            // revalida cache do swr para atualizar as cores do mapa
                            mutateClientes()
                          } catch {
                            alert('Erro ao atualizar o status do cliente.')
                            mutateClientes()
                          }
                        }}
                      >
                        <option value="PENDENTE">Pendente</option>
                        <option value="VISITA_REALIZADA">Visita Realizada</option>
                        <option value="ENTREGA_REALIZADA">Entrega Realizada</option>
                        <option value="TOKEN_ENTREGUE">Token Entregue</option>
                        <option value="FALTA_DOCUMENTOS">Falta de Documentos</option>
                      </select>
                    </div>

                    <button
                      onClick={async () => {
                        const clienteParaRemover = selectedMarker.id
                        setSelectedMarker(null)
                        // optimistic ui: atualiza a view instantaneamente
                        mutateClientes(clientes.filter((c) => c.id !== clienteParaRemover), false)
                        
                        try {
                          await api.delete(`/clientes/${clienteParaRemover}`)
                          mutateClientes()
                        } catch (error: any) {
                          // reverte exclusao caso backend falhe
                          mutateClientes()
                          alert(`Erro ao excluir cliente: ${error.response?.data?.error || error.message}`)
                        }
                      }}
                      className="mt-3 w-full text-xs text-red-600 hover:text-red-700 font-semibold py-1 border border-red-200 hover:bg-red-50 rounded"
                    >
                      Excluir Cliente
                    </button>
                  </div>
                </Popup>
              )
            })()}
          </Map>
        </div>
      </div>

      {visitas.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Ultimas Visitas</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">Agente</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Distancia</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Horario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visitas.map((v) => (
                <tr key={v.id}>
                  {/* previne crash se status for nulo */}
                  <td className="px-5 py-3 text-gray-800 font-medium">{v.user?.name || 'Sistema'}</td>
                  <td className="px-5 py-3 text-gray-500">{v.client?.name || 'Desconhecido'}</td>
                  <td className="px-5 py-3">
                    <span className={
                      'text-xs font-semibold px-2 py-1 rounded-full ' +
                      (v.status === 'VALIDO'
                        ? 'bg-green-100 text-green-700'
                        : v.status === 'FORA_DA_CERCA'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-600')
                    }>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{Math.round(v.distanceToDest)} m</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {new Date(v.serverTimestamp).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalClienteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={fecharModalCliente}
          />

          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">Cadastrar Cliente</h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  placeholder="Razao social ou nome fantasia"
                  value={nomeCliente}
                  onChange={(e) => setNomeCliente(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereco Completo</label>
                <input
                  type="text"
                  placeholder="ex: Rua da Quitanda 86, Centro, Rio de Janeiro"
                  value={enderecoCliente}
                  onChange={(e) => buscarSugestoes(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {suggestions.length > 0 && (
                  <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.map((s) => (
                      <li
                        key={s.id}
                        onClick={() => {
                          setEnderecoCliente(s.place_name)
                          setSelectedCoords(s.center as [number, number])
                          // limpa sugestoes ao selecionar
                          setSuggestions([])
                        }}
                        className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        {s.place_name}
                      </li>
                    ))}
                  </ul>
                )}
                {erroGeocodificacao && (
                  <p className="text-xs text-red-600 mt-1">{erroGeocodificacao}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={fecharModalCliente}
                disabled={salvandoCliente}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarCliente}
                disabled={salvandoCliente}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg"
              >
                {salvandoCliente ? 'Localizando...' : 'Salvar Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
