// src/screens/CheckinScreen.tsx
//
// Tela de check-in de campo para equipe de certificacao digital.
//
// Responsabilidades:
//   - Gaveta nativa com fisica de PanResponder (snap: ABERTA / RECOLHIDA)
//   - GPS orientado a eventos (single-shot, sem rastreamento continuo)
//   - Deteccao de GPS simulado (isMocked) com bloqueio de check-in
//   - Validacao Haversine client-side: "Confirmar Chegada" so habilitado <= 100 m
//   - Payload tipado pronto para POST na API Node.js / Java com validacao Mapbox
//   - Abertura de navegacao via deep link com fallback para URL web

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';

import * as Location from 'expo-location';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkin'>;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

type ClienteAtendimento = {
  id: string;
  nome: string;
  endereco: string;
  servico: string;
  latitude: number;
  longitude: number;
};

type EstadoGps =
  | 'solicitando_permissao'
  | 'capturando'
  | 'disponivel'
  | 'sem_permissao'
  | 'erro';

type OpcaoRelatorio =
  | 'token_entregue'
  | 'cliente_nao_atendeu'
  | 'videoconferencia_realizada'
  | 'pendente'
  | 'faltou_documentacao';

// Payload enviado ao back-end no momento do registro de visita.
type PayloadCheckin = {
  colaborador_id: string;
  cliente_id: string;
  coordenadas: { lat: number; lng: number };
  isMocked: boolean;
  status: OpcaoRelatorio;
  timestamp: string;
};

// ---------------------------------------------------------------------------
// Constantes de layout da gaveta
// ---------------------------------------------------------------------------

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Altura total da gaveta. Deve coincidir com a propriedade 'height' no StyleSheet.
const GAVETA_ALTURA = SCREEN_HEIGHT * 0.58;

// Altura do cabecalho visivel quando a gaveta esta recolhida:
// alca (24px) + cabecalho badge+nome (44px) + margem (12px) = 80px
const CABECALHO_VISIVEL = 80;

// Posicoes de translacao vertical (translateY) para cada estado da gaveta.
const SNAP = {
  ABERTA:    0,                               // gaveta totalmente visivel
  RECOLHIDA: GAVETA_ALTURA - CABECALHO_VISIVEL, // apenas o topo aparece
} as const;

// Limiares para decisao de snap ao soltar o dedo.
const LIMIAR_DRAG_PX     = 60;
const LIMIAR_VELOCIDADE  = 0.5;

// ---------------------------------------------------------------------------
// Dados estaticos dos clientes (substituir por chamada de API)
// ---------------------------------------------------------------------------

const CLIENTES: ClienteAtendimento[] = [
  {
    id: 'alpha',
    nome: 'Contabilidade Alpha',
    endereco: 'Centro - Rio de Janeiro, RJ',
    servico: 'Entrega de Token A3',
    latitude: -22.9027,
    longitude: -43.1772,
  },
  {
    id: 'vida',
    nome: 'Clinica Medica Vida',
    endereco: 'Meier - Rio de Janeiro, RJ',
    servico: 'Validacao Presencial e-CPF',
    latitude: -22.9024,
    longitude: -43.2831,
  },
];

const RAIO_GEOFENCE_METROS = 100;

const REGIAO_INICIAL: Region = {
  latitude:  (CLIENTES[0].latitude  + CLIENTES[1].latitude)  / 2,
  longitude: (CLIENTES[0].longitude + CLIENTES[1].longitude) / 2,
  latitudeDelta:  0.05,
  longitudeDelta: 0.12,
};

const ROTULOS_RELATORIO: Record<OpcaoRelatorio, string> = {
  token_entregue:            'Token entregue',
  cliente_nao_atendeu:       'Cliente nao atendeu',
  videoconferencia_realizada: 'Videoconferencia realizada',
  pendente:                  'Pendente',
  faltou_documentacao:       'Faltou documentacao',
};

const COR_RELATORIO: Record<OpcaoRelatorio, string> = {
  token_entregue:            '#16a34a',
  videoconferencia_realizada: '#1d4ed8',
  cliente_nao_atendeu:       '#dc2626',
  faltou_documentacao:       '#ea580c',
  pendente:                  '#78716c',
};

const OPCOES_RELATORIO: OpcaoRelatorio[] = [
  'token_entregue',
  'videoconferencia_realizada',
  'cliente_nao_atendeu',
  'faltou_documentacao',
  'pendente',
];

// ---------------------------------------------------------------------------
// Utilitarios
// ---------------------------------------------------------------------------

/**
 * Calcula a distancia em metros entre dois pontos geograficos.
 * Formula: Haversine sobre esfera com raio medio da Terra (6 371 000 m).
 */
function haversineMetros(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R   = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Detecta uso de GPS simulado (fake GPS / location spoofer).
 *
 * Android: o sistema operacional popula o campo `mocked` no objeto LocationObject.
 * iOS: nao existe flag nativa equivalente; heuristica: accuracy === 0 indica simulacao
 *      (dispositivos fisicos nunca retornam precisao exatamente zero).
 */
function detectarGpsFake(posicao: Location.LocationObject): boolean {
  if (typeof posicao.mocked === 'boolean') return posicao.mocked;
  return posicao.coords.accuracy === 0;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function CheckinScreen({ route }: Props) {
  const { userId } = route.params;

  // ------ Estado GPS ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const [posicaoUsuario, setPosicaoUsuario] = useState<Location.LocationObject | null>(null);
  const [estadoGps, setEstadoGps]           = useState<EstadoGps>('solicitando_permissao');
  const [gpsIsMocked, setGpsIsMocked]       = useState<boolean>(false);

  // ------ Estado de negocio ------------------------------------------------------------------------------------------------------------------------------------------------------

  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteAtendimento>(CLIENTES[0]);
  const [atendimentoIniciado, setAtendimentoIniciado] = useState<boolean>(false);
  const [statusRelatorio, setStatusRelatorio]         = useState<OpcaoRelatorio | null>(null);

  // ------ Animacao da gaveta ---------------------------------------------------------------------------------------------------------------------------------------------------

  // slideAnim: valor de translateY da gaveta.
  // Inicializado em GAVETA_ALTURA (off-screen abaixo) e animado para SNAP.ABERTA na montagem.
  const slideAnim       = useRef(new Animated.Value(GAVETA_ALTURA)).current;

  // posicaoAtualRef: armazena o ultimo snap confirmado para calculo relativo durante gesto.
  const posicaoAtualRef = useRef<number>(SNAP.ABERTA);

  // ------ PanResponder ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const panResponder = useRef(
    PanResponder.create({
      // Intercepta o gesto apenas se o movimento for predominantemente vertical.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > Math.abs(g.dx) + 4,

      onPanResponderGrant: () => {
        // Congela o valor animado atual como ponto de referencia do gesto em curso.
        // stopAnimation fornece o valor instantaneo, evitando salto visual.
        slideAnim.stopAnimation((val) => {
          posicaoAtualRef.current = val;
        });
      },

      onPanResponderMove: (_, g) => {
        // Translacao relativa: posicao de referencia + deslocamento do dedo.
        // Clamped dentro dos limites validos para nao sair da faixa de snap.
        const novoY = Math.min(
          SNAP.RECOLHIDA,
          Math.max(SNAP.ABERTA, posicaoAtualRef.current + g.dy),
        );
        slideAnim.setValue(novoY);
      },

      onPanResponderRelease: (_, g) => {
        // Decide o snap destino com base no deslocamento acumulado (dy) e velocidade (vy).
        // Arrastar para baixo com distancia ou velocidade suficiente recolhe a gaveta.
        const arrastarBaixo = g.dy > LIMIAR_DRAG_PX || g.vy > LIMIAR_VELOCIDADE;
        const targetY = arrastarBaixo ? SNAP.RECOLHIDA : SNAP.ABERTA;

        posicaoAtualRef.current = targetY;

        // Animated.spring com bounciness moderado: fisica natural sem exagero.
        Animated.spring(slideAnim, {
          toValue: targetY,
          useNativeDriver: true,
          bounciness: 4,
          speed: 14,
        }).start();
      },

      onPanResponderTerminate: () => {
        // Gesto cancelado pelo sistema (ex: notificacao do SO): restaura posicao atual.
        Animated.spring(slideAnim, {
          toValue: posicaoAtualRef.current,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }).start();
      },
    })
  ).current;

  // ------ GPS: captura orientada a eventos ---------------------------------------------------------------------------------------------------------

  /**
   * Captura a posicao atual do dispositivo em alta precisao (single-shot).
   *
   * Design decision: sem rastreamento continuo (watchPositionAsync),
   * conforme requisito de otimizacao de bateria do projeto.
   * Chamada ao focar na tela e via botao de atualizacao manual no mapa.
   */
  const capturarLocalizacaoAtual = useCallback(async (): Promise<void> => {
    setEstadoGps('solicitando_permissao');

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      setEstadoGps('sem_permissao');
      return;
    }

    setEstadoGps('capturando');

    try {
      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      setPosicaoUsuario(posicao);
      setGpsIsMocked(detectarGpsFake(posicao));
      setEstadoGps('disponivel');
    } catch {
      setEstadoGps('erro');
    }
  }, []);

  // Captura GPS ao focar na tela (primeiro carregamento e retorno de navegacao).
  useFocusEffect(
    useCallback(() => {
      capturarLocalizacaoAtual();
    }, [capturarLocalizacaoAtual]),
  );

  // Animacao de entrada da gaveta ao montar o componente.
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: SNAP.ABERTA,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  // ------ Metricas derivadas ---------------------------------------------------------------------------------------------------------------------------------------------------

  // Distancia em metros entre o usuario e o cliente selecionado.
  const distanciaMetros: number | null =
    posicaoUsuario !== null
      ? haversineMetros(
          posicaoUsuario.coords.latitude,
          posicaoUsuario.coords.longitude,
          clienteSelecionado.latitude,
          clienteSelecionado.longitude,
        )
      : null;

  // Determina se o operador esta dentro da geofence do cliente selecionado.
  const dentroGeofence = distanciaMetros !== null && distanciaMetros <= RAIO_GEOFENCE_METROS;

  // ------ Payload e envio ------------------------------------------------------------------------------------------------------------------------------------------------------------

  // Estado de carregamento do envio para desabilitar o botao durante a requisicao.
  const [enviando, setEnviando] = useState<boolean>(false);

  /**
   * Monta o payload no formato exato do schema Prisma e envia via POST para a API.
   *
   * Fluxo:
   *   - HTTP 201: check-in registrado com sucesso -> Alert + gaveta recolhida.
   *   - HTTP 403: fraude de GPS detectada pelo servidor -> Alert com mensagem do servidor.
   *   - Outros erros HTTP ou falha de rede -> Alert generico de erro de conexao.
   */
  async function enviarCheckin(statusVisita: OpcaoRelatorio): Promise<void> {
    if (!posicaoUsuario) return;

    const body = {
      colaboradorId: 'colab-lucas-001',
      clienteId:     'cliente-contabilidade-alpha',
      latitude:      posicaoUsuario.coords.latitude,
      longitude:     posicaoUsuario.coords.longitude,
      isMocked:      gpsIsMocked,
      status:        statusVisita,
    };

    setEnviando(true);

    try {
      const resposta = await fetch('http://192.168.1.10:3333/api/checkin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      const dados = await resposta.json();

      if (resposta.status === 201) {
        Alert.alert(
          'Check-in Registrado',
          'Visita registrada com sucesso.',
          [{ text: 'OK' }],
        );

        // Recolhe a gaveta apos o registro bem-sucedido.
        posicaoAtualRef.current = SNAP.RECOLHIDA;
        Animated.spring(slideAnim, {
          toValue:     SNAP.RECOLHIDA,
          useNativeDriver: true,
          bounciness:  4,
          speed:       14,
        }).start();
        return;
      }

      // Erros retornados pela API (403 fraude, 400 validacao, etc.).
      const mensagemServidor: string =
        dados?.error ?? `Erro ${resposta.status}: tente novamente.`;

      Alert.alert('Falha no Check-in', mensagemServidor, [{ text: 'OK' }]);

    } catch {
      // Falha de rede ou servidor inacessivel.
      Alert.alert(
        'Erro de Conexao',
        'Nao foi possivel conectar ao servidor. Verifique sua rede e tente novamente.',
        [{ text: 'OK' }],
      );
    } finally {
      setEnviando(false);
    }
  }

  // ------ Handlers ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  function selecionarCliente(cliente: ClienteAtendimento): void {
    if (cliente.id !== clienteSelecionado.id) {
      setAtendimentoIniciado(false);
      setStatusRelatorio(null);
    }
    setClienteSelecionado(cliente);
  }

  function confirmarChegada(): void {
    setAtendimentoIniciado(true);
  }

  async function registrarStatus(opcao: OpcaoRelatorio): Promise<void> {
    setStatusRelatorio(opcao);
    await enviarCheckin(opcao);
  }

  /**
   * Abre o aplicativo de navegacao com curva a curva para o cliente selecionado.
   *
   * Fluxo de abertura:
   *   1. Tenta o deep link nativo (google.navigation:q= ou waze://).
   *   2. Se o app nao estiver instalado (canOpenURL retorna false),
   *      cai automaticamente para a URL web do Google Maps.
   */
  function abrirNavegacao(): void {
    const { latitude: lat, longitude: lng } = clienteSelecionado;

    // URL de fallback: funciona em qualquer dispositivo via browser.
    const FALLBACK_URL = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    async function tentarAbrir(url: string): Promise<void> {
      try {
        const suportada = await Linking.canOpenURL(url);
        await Linking.openURL(suportada ? url : FALLBACK_URL);
      } catch {
        // Em caso de erro inesperado, abre o fallback diretamente.
        await Linking.openURL(FALLBACK_URL);
      }
    }

    Alert.alert(
      'Abrir no Mapa',
      'Selecione o aplicativo de navegacao desejado:',
      [
        {
          text: 'Google Maps',
          onPress: () => {
            // google.navigation:q= e o deep link de curva a curva nativo do Google Maps.
            // Requer o app instalado; fallback para URL web se ausente.
            tentarAbrir(`google.navigation:q=${lat},${lng}`);
          },
        },
        {
          text: 'Waze',
          onPress: () => {
            // waze:// e o esquema de URI nativo do Waze para navegacao direta.
            // Requer o app instalado; fallback para URL web se ausente.
            tentarAbrir(`waze://?ll=${lat},${lng}&navigate=yes`);
          },
        },
        {
          // style: 'cancel' renderiza o botao com enfase reduzida no SO
          // e permite fechar o dialogo via gesto de deslize no iOS.
          text: 'Cancelar',
          style: 'cancel',
        },
      ],
    );
  }

  // ------ Render helpers ---------------------------------------------------------------------------------------------------------------------------------------------------------------

  /**
   * Indicador de status do GPS sobreposto ao mapa.
   * Retorna null quando a localizacao esta disponivel (sem poluicao visual).
   */
  function renderIndicadorGps(): React.ReactNode {
    if (estadoGps === 'disponivel') return null;

    const mensagens: Record<Exclude<EstadoGps, 'disponivel'>, string> = {
      solicitando_permissao: 'Solicitando permissao de localizacao...',
      capturando:            'Capturando posicao GPS...',
      sem_permissao:         'Permissao de localizacao negada.',
      erro:                  'Nao foi possivel obter a localizacao.',
    };

    const emAndamento =
      estadoGps === 'solicitando_permissao' || estadoGps === 'capturando';

    return (
      <View style={styles.indicadorGps}>
        {emAndamento && (
          <ActivityIndicator size="small" color="#1d4ed8" style={styles.indicadorSpinner} />
        )}
        <Text style={styles.indicadorTexto}>{mensagens[estadoGps]}</Text>
      </View>
    );
  }

  /**
   * Secao de acoes da gaveta. Transiciona entre tres estados:
   *
   *   Estado A --- relatorio registrado: exibe o status selecionado (tela final).
   *   Estado B --- atendimento nao iniciado: botao "Confirmar Chegada",
   *              habilitado somente se dentroGeofence && !gpsIsMocked.
   *   Estado C --- atendimento iniciado: lista de 5 opcoes de relatorio.
   */
  function renderAcoesAtendimento(): React.ReactNode {
    // Estado A: relatorio ja registrado.
    if (statusRelatorio !== null) {
      return (
        <View style={styles.relatorioRegistrado}>
          <Text style={styles.relatorioRegistradoRotulo}>Status registrado</Text>
          <Text style={styles.relatorioRegistradoValor}>
            {ROTULOS_RELATORIO[statusRelatorio]}
          </Text>
        </View>
      );
    }

    // Estado B: aguardando confirmacao de chegada.
    if (!atendimentoIniciado) {
      const habilitado = dentroGeofence && !gpsIsMocked;

      // Texto do botao e contextual ao motivo de bloqueio.
      let textoBotao: string;
      if (gpsIsMocked) {
        textoBotao = 'Check-in Bloqueado: Emulador de GPS Detectado';
      } else if (!dentroGeofence) {
        textoBotao =
          distanciaMetros !== null
            ? `Fora da area: ${Math.round(distanciaMetros)} m do destino`
            : 'Aguardando localizacao para habilitar';
      } else {
        textoBotao = 'Confirmar Chegada';
      }

      return (
        <TouchableOpacity
          style={[
            styles.botaoConfirmarChegada,
            !habilitado && styles.botaoDesabilitado,
          ]}
          activeOpacity={habilitado ? 0.8 : 1}
          disabled={!habilitado}
          onPress={confirmarChegada}
        >
          <Text
            style={[
              styles.botaoPrincipalTexto,
              !habilitado && styles.botaoPrincipalTextoDesabilitado,
            ]}
          >
            {textoBotao}
          </Text>
        </TouchableOpacity>
      );
    }

    // Estado C: atendimento em curso, exibir opcoes de relatorio.
    return (
      <View style={styles.relatorioContainer}>
        <Text style={styles.relatorioTitulo}>Resultado do atendimento</Text>
        {OPCOES_RELATORIO.map((opcao) => (
          <TouchableOpacity
            key={opcao}
            style={[
              styles.botaoRelatorio,
              { backgroundColor: COR_RELATORIO[opcao] },
              enviando && styles.botaoDesabilitado,
            ]}
            activeOpacity={enviando ? 1 : 0.75}
            disabled={enviando}
            onPress={() => registrarStatus(opcao)}
          >
            <Text style={styles.botaoRelatorioTexto}>{ROTULOS_RELATORIO[opcao]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // ------ JSX principal ------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const coordUsuario =
    posicaoUsuario !== null
      ? {
          latitude:  posicaoUsuario.coords.latitude,
          longitude: posicaoUsuario.coords.longitude,
        }
      : null;

  return (
    <View style={styles.container}>

      {/*
        MapView: camada de fundo, preenche todo o container (flex: 1).
        A gaveta e sobreposta via Animated.View com position: 'absolute'.
        PROVIDER_GOOGLE: obrigatorio no Android para tiles consistentes.
        Em producao: registrar a Google Maps API Key em app.json.
      */}
      <MapView
        style={styles.mapa}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={REGIAO_INICIAL}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/*
          Marcador do operador: renderizado apenas quando o GPS esta disponivel.
          Cor vermelha indica GPS simulado detectado; azul indica localizacao real.
        */}
        {coordUsuario !== null && (
          <Marker
            coordinate={coordUsuario}
            title="Posicao atual"
            description={
              gpsIsMocked
                ? 'ATENCAO: Localizacao simulada detectada'
                : `Precisao: ${posicaoUsuario?.coords.accuracy?.toFixed(0) ?? '--'} m`
            }
            pinColor={gpsIsMocked ? '#dc2626' : '#1d4ed8'}
          />
        )}

        {/*
          Marcadores e geofences dos clientes da ordem de servico.
          Cliente selecionado: marcador verde + geofence com opacidade maior.
          Cliente nao selecionado: marcador cinza + geofence com opacidade reduzida.
          onPress seleciona o cliente e atualiza a gaveta.
        */}
        {CLIENTES.map((cliente) => {
          const selecionado = cliente.id === clienteSelecionado.id;
          return (
            <React.Fragment key={cliente.id}>
              <Marker
                coordinate={{ latitude: cliente.latitude, longitude: cliente.longitude }}
                title={cliente.nome}
                description={cliente.servico}
                pinColor={selecionado ? '#16a34a' : '#64748b'}
                onPress={() => selecionarCliente(cliente)}
              />
              <Circle
                center={{ latitude: cliente.latitude, longitude: cliente.longitude }}
                radius={RAIO_GEOFENCE_METROS}
                fillColor={
                  selecionado
                    ? 'rgba(22, 163, 74, 0.12)'
                    : 'rgba(100, 116, 139, 0.06)'
                }
                strokeColor={
                  selecionado
                    ? 'rgba(22, 163, 74, 0.55)'
                    : 'rgba(100, 116, 139, 0.30)'
                }
                strokeWidth={1.5}
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Indicador de status do GPS: visivel apenas enquanto nao disponivel. */}
      {renderIndicadorGps()}

      {/*
        Botao de atualizacao manual do GPS.
        Posicionado no canto superior direito do mapa.
        Permite ao operador refrescar a coordenada sem sair da tela.
      */}
      <TouchableOpacity
        style={styles.botaoAtualizarGps}
        activeOpacity={0.75}
        disabled={estadoGps === 'capturando' || estadoGps === 'solicitando_permissao'}
        onPress={capturarLocalizacaoAtual}
      >
        {estadoGps === 'capturando' ? (
          <ActivityIndicator size="small" color="#1d4ed8" />
        ) : (
          <Text style={styles.botaoAtualizarGpsTexto}>Atualizar GPS</Text>
        )}
      </TouchableOpacity>

      {/*
        Animated.View da gaveta: sobreposta ao mapa via position: 'absolute'.

        pointerEvents="box-none": toques na area transparente acima da gaveta
        (visivel quando recolhida) passam para o MapView subjacente.
        Os filhos com pointerEvents="auto" continuam recebendo toques normalmente.

        Os handlers do PanResponder sao aplicados APENAS na alca de arrasto,
        evitando conflito com o ScrollView interno e com o MapView.
      */}
      <Animated.View
        style={[styles.gaveta, { transform: [{ translateY: slideAnim }] }]}
        pointerEvents="box-none"
      >
        <SafeAreaView pointerEvents="box-none">

          {/* Alca de arrasto: unica area que intercepta os gestos do PanResponder. */}
          <View
            style={styles.alcaContainer}
            pointerEvents="auto"
            {...panResponder.panHandlers}
          >
            <View style={styles.alca} />
          </View>

          {/* Conteudo da gaveta: recebe toques independentemente do PanResponder. */}
          <View pointerEvents="auto">

            {/* Cabecalho: badge de status operacional e nome do cliente selecionado. */}
            <View style={styles.cabecalho}>
              <View style={[styles.badgeStatus, gpsIsMocked && styles.badgeStatusFraude]}>
                <Text style={[styles.badgeStatusTexto, gpsIsMocked && styles.badgeStatusTextoFraude]}>
                  {gpsIsMocked ? 'GPS BLOQUEADO' : 'EM ROTA'}
                </Text>
              </View>
              <Text style={styles.nomeCliente} numberOfLines={1}>
                {clienteSelecionado.nome}
              </Text>
            </View>

            <View style={styles.separador} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Alerta de fraude: exibido quando GPS simulado e detectado. */}
              {gpsIsMocked && (
                <View style={styles.alertaFraude}>
                  <Text style={styles.alertaFraudeTexto}>
                    Localizacao simulada detectada. O registro de visita foi bloqueado
                    por politica de auditoria.
                  </Text>
                </View>
              )}

              {/* Informacoes do cliente selecionado. */}
              <View style={styles.blocoInfo}>

                <View style={styles.linhaInfo}>
                  <Text style={styles.linhaInfoRotulo}>Servico</Text>
                  <Text style={styles.linhaInfoValor}>{clienteSelecionado.servico}</Text>
                </View>

                <View style={styles.linhaInfo}>
                  <Text style={styles.linhaInfoRotulo}>Endereco</Text>
                  <Text style={styles.linhaInfoValor}>{clienteSelecionado.endereco}</Text>
                </View>

                <View style={styles.linhaInfo}>
                  <Text style={styles.linhaInfoRotulo}>Geofence</Text>
                  <Text style={styles.linhaInfoValor}>{RAIO_GEOFENCE_METROS} metros</Text>
                </View>

                <View style={styles.linhaInfo}>
                  <Text style={styles.linhaInfoRotulo}>Distancia</Text>
                  <Text
                    style={[
                      styles.linhaInfoValor,
                      distanciaMetros === null && styles.valorPendente,
                      // Destaca em verde quando dentro da geofence.
                      dentroGeofence && styles.valorDentroGeofence,
                    ]}
                  >
                    {distanciaMetros !== null
                      ? `${Math.round(distanciaMetros)} m`
                      : 'Aguardando localizacao'}
                  </Text>
                </View>

                <View style={styles.linhaInfo}>
                  <Text style={styles.linhaInfoRotulo}>GPS</Text>
                  <Text
                    style={[
                      styles.linhaInfoValor,
                      estadoGps !== 'disponivel' && styles.valorPendente,
                    ]}
                  >
                    {estadoGps === 'disponivel' && posicaoUsuario !== null
                      ? `${posicaoUsuario.coords.latitude.toFixed(5)}, ${posicaoUsuario.coords.longitude.toFixed(5)}`
                      : 'Aguardando localizacao'}
                  </Text>
                </View>

              </View>

              {/* Botao de navegacao externa com selecao de app via Alert nativo. */}
              <TouchableOpacity
                style={styles.botaoNavegar}
                activeOpacity={0.8}
                onPress={abrirNavegacao}
              >
                <Text style={styles.botaoNavegarTexto}>Navegar</Text>
              </TouchableOpacity>

              {/* Secao de acoes: varia conforme o estado do fluxo de atendimento. */}
              {renderAcoesAtendimento()}

              {/* Troca rapida de cliente na rota. */}
              {CLIENTES.filter((c) => c.id !== clienteSelecionado.id).length > 0 && (
                <>
                  <Text style={styles.seletorTitulo}>Outros clientes na rota</Text>
                  {CLIENTES
                    .filter((c) => c.id !== clienteSelecionado.id)
                    .map((cliente) => (
                      <TouchableOpacity
                        key={cliente.id}
                        style={styles.seletorItem}
                        activeOpacity={0.7}
                        onPress={() => selecionarCliente(cliente)}
                      >
                        <Text style={styles.seletorItemNome}>{cliente.nome}</Text>
                        <Text style={styles.seletorItemServico}>{cliente.servico}</Text>
                      </TouchableOpacity>
                    ))}
                </>
              )}

            </ScrollView>
          </View>
        </SafeAreaView>
      </Animated.View>

    </View>
  );
}

// ---------------------------------------------------------------------------
// Estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },

  // Mapa em tela cheia. A gaveta e sobreposta via Animated.View absoluta.
  mapa: {
    flex: 1,
  },

  // Indicador de GPS: posicionado no topo esquerdo, reservando espaco para o botao GPS.
  indicadorGps: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 120, // margem para o botao "Atualizar GPS" no canto direito
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 6,
  },

  indicadorSpinner: {
    marginRight: 8,
  },

  indicadorTexto: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },

  // Botao de atualizacao manual do GPS: canto superior direito do mapa.
  botaoAtualizarGps: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 6,
  },

  botaoAtualizarGpsTexto: {
    fontSize: 12,
    color: '#1d4ed8',
    fontWeight: '700',
  },

  // Gaveta: Animated.View absoluta no rodape, altura fixa para calculo de snap.
  // zIndex garante posicionamento acima do MapView e do indicador de GPS.
  gaveta: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: GAVETA_ALTURA,
    zIndex: 10,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 16,
  },

  // Alca de arrasto: area que recebe os handlers do PanResponder.
  alcaContainer: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
  },

  alca: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
  },

  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  badgeStatus: {
    backgroundColor: '#dcfce7',
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  badgeStatusFraude: {
    backgroundColor: '#fef2f2',
  },

  badgeStatusTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
    letterSpacing: 1,
  },

  badgeStatusTextoFraude: {
    color: '#dc2626',
  },

  nomeCliente: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },

  separador: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginBottom: 14,
  },

  // Alerta de fraude: exibido quando GPS simulado e detectado.
  alertaFraude: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },

  alertaFraudeTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    lineHeight: 17,
  },

  blocoInfo: {
    gap: 10,
    marginBottom: 18,
  },

  linhaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  linhaInfoRotulo: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    minWidth: 72,
  },

  linhaInfoValor: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    textAlign: 'right',
    lineHeight: 18,
  },

  valorPendente: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },

  // Destaque verde para distancia dentro da geofence.
  valorDentroGeofence: {
    color: '#16a34a',
    fontWeight: '700',
    fontStyle: 'normal',
  },

  botaoNavegar: {
    backgroundColor: '#475569',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  botaoNavegarTexto: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Botao "Confirmar Chegada": azul quando habilitado, cinza quando bloqueado.
  botaoConfirmarChegada: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1d4ed8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },

  botaoDesabilitado: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },

  botaoPrincipalTexto: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  // Texto menor para mensagens de bloqueio que sao mais longas.
  botaoPrincipalTextoDesabilitado: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0,
  },

  relatorioContainer: {
    gap: 8,
    marginBottom: 16,
  },

  relatorioTitulo: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  botaoRelatorio: {
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
  },

  botaoRelatorioTexto: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Card exibido apos o registro do relatorio (estado final da tela).
  relatorioRegistrado: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },

  relatorioRegistradoRotulo: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  relatorioRegistradoValor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },

  seletorTitulo: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  seletorItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  seletorItemNome: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },

  seletorItemServico: {
    fontSize: 12,
    color: '#64748b',
  },

});

