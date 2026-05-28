// src/hooks/useCheckin.ts
// Hook que encapsula toda a lógica de GPS + chamada de check-in
// A tela só precisa chamar "executarCheckin()" e reagir ao estado

import { useState } from 'react';
import * as Location from 'expo-location';
import { realizarCheckin, CheckinResponse } from '../services/api';

// Os estados possíveis do processo de check-in
export type CheckinStatus =
  | 'idle'          // aguardando o usuário apertar o botão
  | 'pedindo_gps'   // solicitando permissão de localização
  | 'capturando'    // lendo as coordenadas do GPS
  | 'enviando'      // POST em andamento para a API
  | 'sucesso'       // check-in registrado com status VALIDO
  | 'fora_da_cerca' // chegou mas não está no raio de 100m
  | 'erro';         // qualquer erro inesperado (rede, GPS negado etc)

export interface CheckinState {
  status: CheckinStatus;
  resultado: CheckinResponse | null;  // resposta da API quando bem-sucedido
  mensagemErro: string | null;        // texto de erro para exibir pro usuário
}

// Parâmetros que o hook precisa para montar o payload da API
interface UseCheckinParams {
  userId: string;
  clientId: string;
}

export function useCheckin({ userId, clientId }: UseCheckinParams) {
  const [state, setState] = useState<CheckinState>({
    status: 'idle',
    resultado: null,
    mensagemErro: null,
  });

  const executarCheckin = async () => {
    // Reseta o estado antes de começar
    setState({ status: 'pedindo_gps', resultado: null, mensagemErro: null });

    // 1. Pede permissão de localização em foreground
    const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
    if (permStatus !== 'granted') {
      setState({
        status: 'erro',
        resultado: null,
        mensagemErro: 'Permissão de localização negada. Habilite o GPS nas configurações.',
      });
      return;
    }

    // 2. Captura a posição com alta precisão
    setState(prev => ({ ...prev, status: 'capturando' }));
    let posicao: Location.LocationObject;
    try {
      posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // pede o melhor sinal disponível
      });
    } catch {
      setState({
        status: 'erro',
        resultado: null,
        mensagemErro: 'Não foi possível obter sua localização. Verifique o GPS.',
      });
      return;
    }

    const { latitude, longitude, accuracy } = posicao.coords;

    // 3. Manda para a API
    setState(prev => ({ ...prev, status: 'enviando' }));
    try {
      const resposta = await realizarCheckin({
        userId,
        clientId,
        capturedLat: latitude,
        capturedLng: longitude,
        gpsAccuracy: accuracy ?? 999, // se accuracy for null, manda 999 (vai falhar na validação do backend de propósito)
        isMocked: false,              // expo-location não retorna GPS mockado, então sempre false aqui
      });

      // 4. Define o status final com base na resposta do servidor
      setState({
        status: resposta.status === 'VALIDO' ? 'sucesso' : 'fora_da_cerca',
        resultado: resposta,
        mensagemErro: null,
      });
    } catch (error: any) {
      // Tenta pegar a mensagem de erro da API (ex: "fraude detectada")
      const msgApi = error?.response?.data?.error ?? 'Erro de comunicação com o servidor.';
      setState({
        status: 'erro',
        resultado: null,
        mensagemErro: msgApi,
      });
    }
  };

  // Volta pro estado inicial — útil para o botão "Tentar Novamente"
  const resetar = () => {
    setState({ status: 'idle', resultado: null, mensagemErro: null });
  };

  return { ...state, executarCheckin, resetar };
}
