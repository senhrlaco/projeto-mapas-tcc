import axios from 'axios';
import Constants from 'expo-constants';

// forca url literal para bypass do cache de env
const BASE_URL = 'https://api-projeto-mapas.onrender.com/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    // rastreador de rota exata no terminal
    console.log(`[REQ] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // extrai payload de erro do backend
    if (error.response) {
      console.log(`[RES_ERROR] HTTP ${error.response.status}`);
    } else {
      console.log(`[NET_ERROR] ${error.message}`);
    }
    return Promise.reject(error);
  }
);

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
