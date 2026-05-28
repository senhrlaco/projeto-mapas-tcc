import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Map, Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

// token do mapbox via variavel de ambiente do Vite
// crie um .env com VITE_MAPBOX_TOKEN=pk.eyJ...

// shape exato que o /ping retorna
type RespostaPing = {
  status: string
  totalUsuarios: number
}

type CardResumo = {
  titulo: string
  valor: string
  detalhe: string
}

// posicoes fixas dos clientes cadastrados no banco — substituir por GET /clientes quando a rota existir
const MARCADORES_FIXOS = [
  { id: 'centro', longitude: -43.1772, latitude: -22.9027, rotulo: 'Centro - Contabilidade Alpha' },
  { id: 'meier', longitude: -43.2831, latitude: -22.9024, rotulo: 'Meier - Clinica Medica Vida' },
]

export default function Dashboard() {
  const navigate = useNavigate()

  const [cards, setCards] = useState<CardResumo[]>([])

  // estado da camera do mapa - centro do RJ como posicao inicial
  const [viewState, setViewState] = useState({
    longitude: -43.1772,
    latitude: -22.9027,
    zoom: 11,
  })

  useEffect(() => {
    async function carregarDashboard() {
      try {
        const res = await fetch(`${baseURL}/ping`, {
          headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('token'),
          },
        })

        // token expirado ou sem permissao: manda pro login
        if (res.status === 401 || res.status === 403) {
          localStorage.clear()
          navigate('/login')
          return
        }

        if (!res.ok) {
          console.error('Falha ao carregar dados do dashboard:', res.status)
          return
        }

        const data: RespostaPing = await res.json()

        // transforma a resposta do /ping nos cards da tela
        setCards([
          { titulo: 'Usuarios Cadastrados', valor: String(data.totalUsuarios), detalhe: 'registros ativos no banco' },
        ])
      } catch {
        // sem alert pra nao irritar o usuario toda vez que a rede cair
        console.error('Nao foi possivel conectar ao servidor para carregar o dashboard.')
      }
    }

    carregarDashboard()
  }, [])

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Visao Geral</h1>
        <p className="text-sm text-gray-500 mt-1">Resumo das operacoes de campo</p>
      </div>

      {/* cards de resumo */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.titulo} className="bg-white rounded-lg shadow-md p-5">
            <p className="text-sm text-gray-500">{card.titulo}</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{card.valor}</p>
            <p className="text-xs text-gray-400 mt-1">{card.detalhe}</p>
          </div>
        ))}
      </div>

      {/* mapa mapbox */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Mapa de Visitas</p>
        </div>

        {/* token so carrega se a variavel existir no .env */}
        <div className="min-h-[75vh] w-full rounded-lg shadow-md overflow-hidden">
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
          >
            {MARCADORES_FIXOS.map((m) => (
              <Marker
                key={m.id}
                longitude={m.longitude}
                latitude={m.latitude}
                color="red"
              />
            ))}
          </Map>
        </div>
      </div>
    </div>
  )
}
