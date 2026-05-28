// src/services/api.ts
// Configuração central do Axios — toda chamada de API passa por aqui

import axios from 'axios';

// Em dev, aponta pro localhost. Em produção trocar pela URL real.
// No Android Emulator, o localhost da máquina é acessível via 10.0.2.2
// No Expo Go com dispositivo físico, usar o IP da máquina na rede local
const BASE_URL = 'http://10.0.2.2:3333';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10 segundos — suficiente pra qualquer operação normal
  headers: {
    'Content-Type': 'application/json',
  },
});

// ---------- Tipos que espelham o contrato da API ----------

// Payload que mandamos pro POST /checkin
export interface CheckinPayload {
  userId: string;
  clientId: string;
  capturedLat: number;
  capturedLng: number;
  gpsAccuracy: number;
  isMocked: boolean;
}

// Resposta de sucesso do POST /checkin
export interface CheckinResponse {
  mensagem: string;
  distancia: string;        // ex: "42 metros"
  status: 'VALIDO' | 'FORA_DA_CERCA';
  idVisita: string;
}

// Payload do POST /usuarios (usado no login/criação de conta)
export interface LoginPayload {
  name?: string;
  email: string;
  password: string;
}

// ---------- Funções de chamada ----------

// Envia o check-in com localização para o backend
export async function realizarCheckin(payload: CheckinPayload): Promise<CheckinResponse> {
  const { data } = await api.post<CheckinResponse>('/checkin', payload);
  return data;
}
