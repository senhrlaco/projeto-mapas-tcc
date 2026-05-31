import { Navigate } from 'react-router-dom'
import useSWR from 'swr'
import { fetcher } from '../lib/fetcher'

type Checkin = {
  id: string
  status: string
  latitude: number
  longitude: number
  observacao?: string
  createdAt: string
  colaborador: { nome: string }
  cliente: { name: string }
}

export default function Auditoria() {
  const { data: checkins = [], error: checkinsError } = useSWR<Checkin[]>(
    '/checkins',
    fetcher,
    { refreshInterval: 10_000 },
  )

  const erroDeAutenticacao = checkinsError && ((checkinsError as any).status === 401 || (checkinsError as any).status === 403)
  
  if (erroDeAutenticacao) {
    localStorage.removeItem('@Savez:token')
    return <Navigate to="/login" replace />
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Auditoria de Operacoes</h1>
        <p className="text-sm text-gray-500 mt-1">Historico de check-ins detalhado</p>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* separa tabela de logs em rota dedicada para melhor ux */}
        <div className="px-5 py-3 border-b border-gray-100 flex justify-between items-center">
          <p className="text-sm font-semibold text-gray-700">Tabela de Auditoria (Check-ins)</p>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{checkins.length} registros</span>
        </div>
        
        {checkins.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Nenhum check-in registrado ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left">
                <th className="px-5 py-3 font-semibold text-gray-600">Data / Hora</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Agente</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Cliente</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Local Exato (GPS)</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 font-semibold text-gray-600">Observacao</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {checkins.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-600 text-xs">
                    {new Date(v.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-5 py-3 text-gray-800 font-medium">{v.colaborador?.nome || 'Sistema'}</td>
                  <td className="px-5 py-3 text-gray-500">{v.cliente?.name || 'Desconhecido'}</td>
                  <td className="px-5 py-3">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${v.latitude},${v.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-xs inline-flex items-center gap-1"
                    >
                      Ver no Mapa
                    </a>
                  </td>
                  <td className="px-5 py-3">
                    <span className={
                      'text-[10px] font-bold px-2 py-1 rounded tracking-wider uppercase inline-block ' +
                      (v.status === 'TOKEN_ENTREGUE' || v.status === 'VALIDO'
                        ? 'bg-green-100 text-green-800'
                        : v.status === 'NECESSITA_DOCUMENTACAO'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-100 text-blue-800')
                    }>
                      {v.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600 italic">
                    {v.observacao || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
