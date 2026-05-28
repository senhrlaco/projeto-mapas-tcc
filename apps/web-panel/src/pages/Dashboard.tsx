import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map, Marker, Popup } from 'react-map-gl/mapbox'
import useSWR from 'swr'
import 'mapbox-gl/dist/mapbox-gl.css'
import { fetcher } from '../lib/fetcher'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

// token do mapbox via variavel de ambiente do Vite
// adicione VITE_MAPBOX_TOKEN=pk.eyJ... no .env do web-panel

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
}

// marcador selecionado pode ser cliente ou nulo — visitas nao tem coordenadas proprias
type MarkerSelecionado = Cliente | null

type RespostaPing = {
  status: string
  totalUsuarios: number
}

export default function Dashboard() {
  const navigate = useNavigate()

  // controla qual marcador esta com o popup aberto
  const [selectedMarker, setSelectedMarker] = useState<MarkerSelecionado>(null)

  // modal de cadastro de cliente por geocoding
  const [modalClienteAberto, setModalClienteAberto] = useState(false)
  const [nomeCliente, setNomeCliente] = useState('')
  const [enderecoCliente, setEnderecoCliente] = useState('')
  const [erroGeocodificacao, setErroGeocodificacao] = useState('')
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  // estado da camera do mapa - centro do RJ como posicao inicial
  const [viewState, setViewState] = useState({
    longitude: -43.1772,
    latitude: -22.9027,
    zoom: 11,
  })

  // busca os totais do servidor — sem polling, dado relativamente estatico
  const { data: ping, error: pingError } = useSWR<RespostaPing>(`${baseURL}/ping`, fetcher)

  // busca a lista de clientes para renderizar no mapa — sem polling
  const {
    data: clientes = [],
    mutate: mutateClientes,
    error: clientesError,
  } = useSWR<Cliente[]>(`${baseURL}/clientes`, fetcher)

  // polling de visitas a cada 10 segundos via refreshInterval do SWR
  // o SWR gerencia o intervalo internamente, sem risco de memory leak
  const { data: visitas = [], error: visitasError } = useSWR<Visita[]>(
    `${baseURL}/visitas`,
    fetcher,
    { refreshInterval: 10_000 },
  )

  // redireciona pro login se qualquer requisicao retornar 401 ou 403
  const erros = [pingError, clientesError, visitasError]
  const erroDeAutenticacao = erros.some(
    (e) => e && ((e as Error & { status?: number }).status === 401 || (e as Error & { status?: number }).status === 403),
  )
  if (erroDeAutenticacao) {
    localStorage.clear()
    navigate('/login')
  }

  // headers para as operacoes de escrita que nao passam pelo fetcher
  function headersEscrita(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + localStorage.getItem('token'),
    }
  }

  function abrirModalCliente() {
    setNomeCliente('')
    setEnderecoCliente('')
    setErroGeocodificacao('')
    setModalClienteAberto(true)
  }

  function fecharModalCliente() {
    setModalClienteAberto(false)
    setNomeCliente('')
    setEnderecoCliente('')
    setErroGeocodificacao('')
  }

  async function salvarCliente() {
    if (!nomeCliente || !enderecoCliente) {
      setErroGeocodificacao('Preencha o nome e o endereco do cliente.')
      return
    }

    setErroGeocodificacao('')
    setSalvandoCliente(true)

    try {
      // geocodifica o endereco digitado para obter as coordenadas reais
      const geocodeURL =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
        `${encodeURIComponent(enderecoCliente)}.json` +
        `?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}&limit=1`

      const geocodeRes = await fetch(geocodeURL)

      if (!geocodeRes.ok) {
        setErroGeocodificacao('Servico de geocodificacao indisponivel. Tente novamente.')
        return
      }

      const geocodeData = await geocodeRes.json()

      // valida se o endereco retornou algum resultado
      if (!geocodeData.features || geocodeData.features.length === 0) {
        setErroGeocodificacao('Endereco nao encontrado. Tente ser mais especifico.')
        return
      }

      // Extrai coordenadas garantindo a ordem [lng, lat] do Mapbox
      const [lng, lat] = geocodeData.features[0].center as [number, number]

      // validacao extra antes de enviar — Mapbox raramente retorna NaN, mas o guard nao custa nada
      if (isNaN(lat) || isNaN(lng)) {
        setErroGeocodificacao('Coordenadas invalidas retornadas pelo servico de geocodificacao.')
        return
      }

      const res = await fetch(`${baseURL}/clientes`, {
        method: 'POST',
        headers: headersEscrita(),
        body: JSON.stringify({
          name: nomeCliente,
          address: enderecoCliente,
          latitude: lat,
          longitude: lng,
        }),
      })

      if (res.status === 401 || res.status === 403) {
        localStorage.clear()
        navigate('/login')
        return
      }

      if (!res.ok) {
        setErroGeocodificacao('Nao foi possivel cadastrar o cliente no servidor.')
        return
      }

      // invalida o cache do SWR — o mapa reflete o novo pino imediatamente
      mutateClientes()
      fecharModalCliente()
    } catch {
      setErroGeocodificacao('Falha de conexao. Verifique a rede e tente novamente.')
    } finally {
      setSalvandoCliente(false)
    }
  }

  return (
    <div className="p-8">

      {/* cabecalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Visao Geral</h1>
          <p className="text-sm text-gray-500 mt-1">Resumo das operacoes de campo</p>
        </div>
        <button
          onClick={abrirModalCliente}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          Cadastrar Cliente
        </button>
      </div>

      {/* cards de resumo */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-5">
          <p className="text-sm text-gray-500">Usuarios Cadastrados</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{ping?.totalUsuarios ?? '--'}</p>
          <p className="text-xs text-gray-400 mt-1">registros ativos no banco</p>
        </div>

        {/* card de total de visitas — atualiza junto com o polling do SWR */}
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

      {/* mapa mapbox */}
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
            {/* pinos dos clientes — coordenadas validadas para evitar NaN no Mapbox */}
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
                    // impede que o clique no marcador propague para o mapa
                    e.originalEvent.stopPropagation()
                    setSelectedMarker(c)
                  }}
                />
              )
            })}

            {/* popup do marcador selecionado */}
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
                  <div className="text-sm min-w-[160px]">
                    <p className="font-semibold text-gray-800">{selectedMarker.name}</p>
                    {selectedMarker.address && (
                      <p className="text-gray-500 text-xs mt-1">{selectedMarker.address}</p>
                    )}
                  </div>
                </Popup>
              )
            })()}
          </Map>
        </div>
      </div>

      {/* tabela das ultimas visitas */}
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
                  <td className="px-5 py-3 text-gray-800 font-medium">{v.user.name}</td>
                  <td className="px-5 py-3 text-gray-500">{v.client.name}</td>
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

      {/* modal de cadastro de cliente via geocoding */}
      {modalClienteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* fundo escuro */}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereco Completo</label>
                <input
                  type="text"
                  placeholder="ex: Rua da Quitanda 86, Centro, Rio de Janeiro"
                  value={enderecoCliente}
                  onChange={(e) => {
                    setEnderecoCliente(e.target.value)
                    // limpa o erro ao comecar a digitar novamente
                    if (erroGeocodificacao) setErroGeocodificacao('')
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* feedback de erro do geocoding — visivel apenas quando necessario */}
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
