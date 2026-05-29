
import { useState } from 'react';
import * as Location from 'expo-location';
import { realizarCheckin, CheckinResponse } from '../services/api';

export type CheckinStatus =
  | 'idle'          // aguardando o usuario apertar o botao
  | 'pedindo_gps'   // solicitando permissao de localizacao
  | 'capturando'    // lendo coordenadas do gps
  | 'enviando'      // post em andamento para a api
  | 'sucesso'       // check-in registrado com status valido
  | 'fora_da_cerca' // fora do raio de 100m
  | 'erro';         // erro inesperado (rede, gps negado etc)

export interface CheckinState {
  status: CheckinStatus;
  resultado: CheckinResponse | null;  // resposta da api quando bem-sucedido
  mensagemErro: string | null;        // texto de erro para exibir ao usuario
}

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
    setState({ status: 'pedindo_gps', resultado: null, mensagemErro: null });

    const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
    if (permStatus !== 'granted') {
      setState({
        status: 'erro',
        resultado: null,
        mensagemErro: 'Permissão de localização negada. Habilite o GPS nas configurações.',
      });
      return;
    }

    setState(prev => ({ ...prev, status: 'capturando' }));
    let posicao: Location.LocationObject;
    try {
      posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High, // melhor sinal disponivel
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

    setState(prev => ({ ...prev, status: 'enviando' }));
    try {
      const resposta = await realizarCheckin({
        userId,
        clientId,
        capturedLat: latitude,
        capturedLng: longitude,
        gpsAccuracy: accuracy ?? 999, // null vira 999 para falhar na validacao do backend
        isMocked: false,              // expo-location nao retorna gps mockado
      });

      setState({
        status: resposta.status === 'VALIDO' ? 'sucesso' : 'fora_da_cerca',
        resultado: resposta,
        mensagemErro: null,
      });
    } catch (error: any) {
      const msgApi = error?.response?.data?.error ?? 'Erro de comunicação com o servidor.';
      setState({
        status: 'erro',
        resultado: null,
        mensagemErro: msgApi,
      });
    }
  };

  const resetar = () => {
    setState({ status: 'idle', resultado: null, mensagemErro: null });
  };

  return { ...state, executarCheckin, resetar };
}
