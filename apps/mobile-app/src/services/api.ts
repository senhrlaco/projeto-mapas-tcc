import axios from 'axios';
import Constants from 'expo-constants';

// busca ip da rede local via expo
const hostUri = Constants.expoConfig?.hostUri;
const localIp = hostUri ? hostUri.split(':')[0] : null;

// prioridade para variavel de producao
// fallback seguro para emulador
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (localIp ? `http://${localIp}:3333` : null) ||
  'http://10.0.2.2:3333';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface CheckinPayload {
  userId: string;
  clientId: string;
  capturedLat: number;
  capturedLng: number;
  gpsAccuracy: number;
  isMocked: boolean;
  statusOperacional?: string;
}

export interface CheckinResponse {
  mensagem: string;
  distancia: string;        // ex: '42 metros'
  status: 'VALIDO' | 'FORA_DA_CERCA';
  idVisita: string;
}

export interface LoginPayload {
  name?: string;
  email: string;
  password: string;
}

export async function realizarCheckin(payload: CheckinPayload): Promise<CheckinResponse> {
  const { data } = await api.post<CheckinResponse>('/checkin', payload);
  return data;
}
