import { useState } from 'react'
import { Map, Marker } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

// token do mapbox via variavel de ambiente do Vite
// crie um .env com VITE_MAPBOX_TOKEN=pk.eyJ...

// pinos de teste das duas unidades do TCC
const MARCADORES = [
  { id: 'centro', longitude: -43.1772, latitude: -22.9027, rotulo: 'Centro - Contabilidade Alpha' },
  { id: 'meier',  longitude: -43.2831, latitude: -22.9024, rotulo: 'Meier - Clinica Medica Vida' },
]

export default function Dashboard() {
  // numeros ficticios ate ligar na API
  const cards = [
    { titulo: 'Total de Visitas', valor: '128', detalhe: 'no mes atual' },
    { titulo: 'Fora do Raio',     valor: '14',  detalhe: 'alertas geofence' },
    { titulo: 'Pendentes',        valor: '7',   detalhe: 'aguardando registro' },
  ]

  // estado da camera do mapa - centro do RJ
  const [viewState, setViewState] = useState({
    longitude: -43.1772,
    latitude:  -22.9027,
    zoom:      11,
  })

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
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
          className="min-h-[75vh] w-full rounded-lg shadow-md overflow-hidden"
        >
          {/* pinos de teste */}
          {MARCADORES.map((m) => (
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
  )
}
