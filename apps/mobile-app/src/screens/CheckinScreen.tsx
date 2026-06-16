
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
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';

import * as Location from 'expo-location';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../services/api';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkin'>;

// ---------------------------------------------------------------------------


type ClienteAtendimento = {
  id: string;
  nome: string;
  endereco: string;
  servico: string;
  status: OpcaoRelatorio;
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
  | 'TOKEN_ENTREGUE'
  | 'NECESSITA_DOCUMENTACAO'
  | 'PENDENTE';

// payload enviado ao back-end no registro de visita
type PayloadCheckin = {
  clienteId: string;
  latitude: number;
  longitude: number;
  isMocked: boolean;
  status: string;
  observacao?: string;
};

// ---------------------------------------------------------------------------


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// altura total da gaveta — deve coincidir com a propriedade height no stylesheet
const GAVETA_ALTURA = SCREEN_HEIGHT * 0.58;

// altura do cabecalho visivel quando a gaveta esta recolhida:
// alca (24px) + cabecalho badge+nome (44px) + margem (12px) = 80px
const CABECALHO_VISIVEL = 80;

// posicoes de translacao vertical (translateY) para cada estado da gaveta
const SNAP = {
  ABERTA: 0,                               // gaveta totalmente visivel
  RECOLHIDA: GAVETA_ALTURA - CABECALHO_VISIVEL, // apenas o topo aparece
} as const;

// limiares para decisao de snap ao soltar o dedo
const LIMIAR_DRAG_PX = 60;
const LIMIAR_VELOCIDADE = 0.5;

// ---------------------------------------------------------------------------


const RAIO_GEOFENCE_METROS = 100;

const REGIAO_INICIAL: Region = {
  latitude: -22.9027,
  longitude: -43.1772,
  latitudeDelta: 0.05,
  longitudeDelta: 0.12,
};

const ROTULOS_RELATORIO: Record<OpcaoRelatorio, string> = {
  TOKEN_ENTREGUE: 'Token Entregue',
  NECESSITA_DOCUMENTACAO: 'Necessita Documentacao',
  PENDENTE: 'Pendente',
};

const COR_RELATORIO: Record<OpcaoRelatorio, string> = {
  TOKEN_ENTREGUE: '#16a34a',
  NECESSITA_DOCUMENTACAO: '#f59e0b',
  PENDENTE: '#3b82f6',
};

const OPCOES_RELATORIO: OpcaoRelatorio[] = [
  'TOKEN_ENTREGUE',
  'NECESSITA_DOCUMENTACAO',
  'PENDENTE',
];

// ---------------------------------------------------------------------------


function haversineMetros(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// detecta uso de gps simulado
// android: campo mocked do LocationObject; ios: accuracy === 0 indica simulacao
function detectarGpsFake(posicao: Location.LocationObject): boolean {
  if (typeof posicao.mocked === 'boolean') return posicao.mocked;
  return posicao.coords.accuracy === 0;
}

// ---------------------------------------------------------------------------


export default function CheckinScreen() {
  const { user, signOut } = useAuth();
  const userId = user?.id;


  const [posicaoUsuario, setPosicaoUsuario] = useState<Location.LocationObject | null>(null);
  const [estadoGps, setEstadoGps] = useState<EstadoGps>('solicitando_permissao');
  const [gpsIsMocked, setGpsIsMocked] = useState<boolean>(false);

  const [clientes, setClientes] = useState<ClienteAtendimento[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteAtendimento | null>(null);
  const [atendimentoIniciado, setAtendimentoIniciado] = useState<boolean>(false);
  const [statusRelatorio, setStatusRelatorio] = useState<OpcaoRelatorio | null>(null);
  const [notaOpcional, setNotaOpcional] = useState<string>('');
  const [mostrarLista, setMostrarLista] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // busca a lista de clientes na api e atualiza o estado local
  // funcao extraida para ser reutilizada por focus, pull-to-refresh e botao do mapa
  const buscarClientes = useCallback(async (): Promise<void> => {
    try {
      const { data } = await api.get('/clientes');
      const mapeados = data.map((c: any) => {
        const rawStatus = c.statusOperacional || 'PENDENTE';
        return {
          id: c.id,
          nome: c.name,
          endereco: c.address,
          status: rawStatus as OpcaoRelatorio,
          servico: ROTULOS_RELATORIO[rawStatus as OpcaoRelatorio] || 'Pendente',
          latitude: c.latitude,
          longitude: c.longitude,
        };
      });
      setClientes(mapeados);
      if (mapeados.length > 0) {
        setClienteSelecionado((prev) => prev || mapeados[0]);
      }
    } catch (err) {
      console.log('[API] erro ao buscar clientes', err);
    }
  }, []);

  // recarrega lista de clientes silenciosamente no foco da tela
  useFocusEffect(
    useCallback(() => {
      buscarClientes();
    }, [buscarClientes])
  );

  // permite atualizacao manual arrastando a lista para baixo
  const onRefreshClientes = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    await buscarClientes();
    setIsRefreshing(false);
  }, [buscarClientes]);


  // slideAnim: translateY da gaveta — parte fora da tela e anima para SNAP.ABERTA
  const slideAnim = useRef(new Animated.Value(GAVETA_ALTURA)).current;

  // posicaoAtualRef: ultimo snap confirmado para calculo relativo durante gesto
  const posicaoAtualRef = useRef<number>(SNAP.ABERTA);


  const panResponder = useRef(
    PanResponder.create({
      // intercepta o gesto apenas se o movimento for predominantemente vertical
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > Math.abs(g.dx) + 4,

      onPanResponderGrant: () => {
        // congela o valor animado atual como ponto de referencia do gesto
        // stopAnimation fornece o valor instantaneo, evitando salto visual
        slideAnim.stopAnimation((val) => {
          posicaoAtualRef.current = val;
        });
      },

      onPanResponderMove: (_, g) => {
        // translacao relativa: posicao de referencia + deslocamento do dedo
        // clamped dentro dos limites validos
        const novoY = Math.min(
          SNAP.RECOLHIDA,
          Math.max(SNAP.ABERTA, posicaoAtualRef.current + g.dy),
        );
        slideAnim.setValue(novoY);
      },

      onPanResponderRelease: (_, g) => {
        // decide o snap destino com base no deslocamento (dy) e velocidade (vy)
        const arrastarBaixo = g.dy > LIMIAR_DRAG_PX || g.vy > LIMIAR_VELOCIDADE;
        const targetY = arrastarBaixo ? SNAP.RECOLHIDA : SNAP.ABERTA;

        posicaoAtualRef.current = targetY;

        // spring com bounciness moderado: fisica natural sem exagero
        Animated.spring(slideAnim, {
          toValue: targetY,
          useNativeDriver: true,
          bounciness: 4,
          speed: 14,
        }).start();
      },

      onPanResponderTerminate: () => {
        // gesto cancelado pelo sistema: restaura posicao atual
        Animated.spring(slideAnim, {
          toValue: posicaoAtualRef.current,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }).start();
      },
    })
  ).current;


  // captura posicao atual em alta precisao (single-shot)
  // sem rastreamento continuo para preservar bateria
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

  useFocusEffect(
    useCallback(() => {
      capturarLocalizacaoAtual();
    }, [capturarLocalizacaoAtual]),
  );

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: SNAP.ABERTA,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);


  const distanciaMetros: number | null =
    posicaoUsuario !== null && clienteSelecionado !== null
      ? haversineMetros(
        posicaoUsuario.coords.latitude,
        posicaoUsuario.coords.longitude,
        clienteSelecionado.latitude,
        clienteSelecionado.longitude,
      )
      : null;

  const dentroGeofence = distanciaMetros !== null && distanciaMetros <= RAIO_GEOFENCE_METROS;


  const [enviando, setEnviando] = useState<boolean>(false);

  // monta o payload no schema prisma e envia via post para a api
  // 201: sucesso; 403: fraude detectada; outros: erro de conexao
  async function enviarCheckin(statusVisita: OpcaoRelatorio): Promise<void> {
    if (!posicaoUsuario || !clienteSelecionado) return;

    // constroi o payload estrito garantindo tipos
    const body: PayloadCheckin = {
      clienteId: clienteSelecionado.id,
      latitude: posicaoUsuario.coords.latitude,
      longitude: posicaoUsuario.coords.longitude,
      isMocked: gpsIsMocked,
      status: statusVisita,
      observacao: notaOpcional,
    };

    setEnviando(true);
    console.log('[MOBILE_PAYLOAD]', body);

    try {
      const resposta = await api.post('/checkin', body);
      const dados = resposta.data;

      if (resposta.status === 201 || resposta.status === 200) {
        Alert.alert(
          'Check-in Registrado',
          'Visita registrada com sucesso.',
          [{ text: 'OK' }],
        );

        // recolhe a gaveta apos registro bem-sucedido
        posicaoAtualRef.current = SNAP.RECOLHIDA;
        Animated.spring(slideAnim, {
          toValue: SNAP.RECOLHIDA,
          useNativeDriver: true,
          bounciness: 4,
          speed: 14,
        }).start();
        return;
      }

      // erros retornados pela api (403 fraude, 400 validacao etc)
      const mensagemServidor: string =
        dados?.error ?? `Erro ${resposta.status}: tente novamente.`;

      Alert.alert('Falha no Check-in', mensagemServidor, [{ text: 'OK' }]);

    } catch (err: any) {
      // expoe o erro real da api no alert
      const erroReal = err.response?.data?.error || err.response?.data?.message || 'Erro de conexao';
      Alert.alert('Falha no Check-in', erroReal, [{ text: 'OK' }]);
    } finally {
      setEnviando(false);
    }
  }


  function selecionarCliente(cliente: ClienteAtendimento): void {
    if (clienteSelecionado && cliente.id !== clienteSelecionado.id) {
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
    if (!clienteSelecionado) return;
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

  // ------ render helpers

  // indicador de status do gps sobreposto ao mapa
  // retorna null quando a localizacao esta disponivel
  function renderIndicadorGps(): React.ReactNode {
    if (estadoGps === 'disponivel') return null;

    const mensagens: Record<Exclude<EstadoGps, 'disponivel'>, string> = {
      solicitando_permissao: 'Solicitando permissao de localizacao...',
      capturando: 'Capturando posicao GPS...',
      sem_permissao: 'Permissao de localizacao negada.',
      erro: 'Nao foi possivel obter a localizacao.',
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

  // secao de acoes da gaveta com tres estados:
  // A: relatorio registrado, B: aguardando chegada, C: atendimento em curso
  function renderAcoesAtendimento(): React.ReactNode {
    // A armadilha original 'Estado A: relatorio ja registrado' foi removida porque 
    // ela causava conflito de inferência de tipos (never) e engolia a renderização 
    // do formulário de observação.

    // Estado B: aguardando confirmacao de chegada
    if (!atendimentoIniciado) {
      const habilitado = dentroGeofence && !gpsIsMocked;

      // texto do botao e contextual ao motivo de bloqueio
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

    // forca exibicao do campo de texto com tratamento de case sensitive
    const mostrarComentario = statusRelatorio?.toUpperCase() === 'PENDENTE' ||
      statusRelatorio?.toUpperCase() === 'NECESSITA_DOCUMENTACAO' ||
      (statusRelatorio as string) === 'Necessita Documentacao';

    // Estado C: atendimento em curso, exibir opcoes de relatorio
    if (mostrarComentario) {
      return (
        <View style={styles.relatorioContainer}>
          <Text style={styles.relatorioTitulo}>Observação Adicional</Text>
          {/* renderiza campo de comentario opcional estilo monday */}
          <TextInput
            style={styles.inputObservacao}
            placeholder="Digite o motivo da pendência..."
            placeholderTextColor="#94a3b8"
            value={notaOpcional}
            onChangeText={setNotaOpcional}
            multiline={true}
          />
          <TouchableOpacity
            style={[styles.botaoConfirmarChegada, enviando && styles.botaoDesabilitado]}
            disabled={enviando}
            onPress={() => enviarCheckin(statusRelatorio!)}
          >
            <Text style={styles.botaoPrincipalTexto}>Confirmar Envio</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.botaoCancelarSecundario}
            onPress={() => {
              setStatusRelatorio(null);
              setNotaOpcional('');
            }}
          >
            <Text style={styles.botaoCancelarSecundarioTexto}>Voltar</Text>
          </TouchableOpacity>
        </View>
      );
    }

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
            onPress={() => {
              if (opcao === 'NECESSITA_DOCUMENTACAO' || opcao === 'PENDENTE') {
                setStatusRelatorio(opcao);
              } else {
                enviarCheckin(opcao);
              }
            }}
          >
            <Text style={styles.botaoRelatorioTexto}>{ROTULOS_RELATORIO[opcao]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // ------ jsx principal

  const coordUsuario =
    posicaoUsuario !== null
      ? {
        latitude: posicaoUsuario.coords.latitude,
        longitude: posicaoUsuario.coords.longitude,
      }
      : null;

  return (
    <View style={styles.container}>

      {/*
        mapview: camada de fundo que preenche o container (flex: 1)
        gaveta sobreposta via animated.view com position: absolute
        provider_google: obrigatorio no android para tiles consistentes
        em producao: registrar a google maps api key em app.json
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
          marcador do operador: exibido apenas quando o gps esta disponivel
          vermelho indica gps simulado; azul indica localizacao real
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
          marcadores e geofences dos clientes da ordem de servico
          selecionado: marcador verde + geofence com opacidade maior
          nao selecionado: marcador cinza + geofence com opacidade reduzida
        */}
        {clientes.map((cliente) => {
          const selecionado = clienteSelecionado && cliente.id === clienteSelecionado.id;
          return (
            <React.Fragment key={cliente.id}>
              <Marker
                coordinate={{ latitude: cliente.latitude, longitude: cliente.longitude }}
                title={cliente.nome}
                description={cliente.servico}
                pinColor={selecionado ? COR_RELATORIO[cliente.status] || '#16a34a' : '#64748b'}
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

      {/* indicador de status do gps */}
      {renderIndicadorGps()}

      {/*
        botao de atualizacao manual do gps — canto superior direito do mapa
        permite refrescar a coordenada sem sair da tela
      */}
      <TouchableOpacity
        style={[styles.botaoAtualizarGps, { left: 16, right: 'auto', backgroundColor: '#ef4444' }]}
        activeOpacity={0.75}
        onPress={signOut}
      >
        <Text style={[styles.botaoAtualizarGpsTexto, { color: '#ffffff' }]}>Sair</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.botaoAtualizarGps, { top: 64, left: 16, right: 'auto', backgroundColor: '#3b82f6' }]}
        activeOpacity={0.75}
        onPress={() => setMostrarLista(true)}
      >
        <Text style={[styles.botaoAtualizarGpsTexto, { color: '#ffffff' }]}>Ver Lista</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botaoAtualizarGps}
        activeOpacity={0.75}
        disabled={estadoGps === 'capturando' || estadoGps === 'solicitando_permissao'}
        onPress={() => {
          // recarrega posicao gps e lista de clientes simultaneamente
          capturarLocalizacaoAtual();
          buscarClientes();
        }}
      >
        {estadoGps === 'capturando' ? (
          <ActivityIndicator size="small" color="#1d4ed8" />
        ) : (
          <Text style={styles.botaoAtualizarGpsTexto}>Atualizar GPS</Text>
        )}
      </TouchableOpacity>

      {/*
        animated.view da gaveta: sobreposta ao mapa via position: absolute
        pointersevents box-none: toques na area transparente passam para o mapview
        panresponder aplicado apenas na alca de arrasto
      */}
      <Animated.View
        style={[styles.gaveta, { transform: [{ translateY: slideAnim }] }]}
        pointerEvents="box-none"
      >
        <SafeAreaView pointerEvents="box-none">

          {/* alca de arrasto: unica area que intercepta os gestos do panresponder */}
          <View
            style={styles.alcaContainer}
            pointerEvents="auto"
            {...panResponder.panHandlers}
          >
            <View style={styles.alca} />
          </View>

          {/* conteudo da gaveta */}
          <View pointerEvents="auto">

            {/* cabecalho: badge de status e nome do cliente selecionado */}
            <View style={styles.cabecalho}>
              <View style={[styles.badgeStatus, gpsIsMocked && styles.badgeStatusFraude]}>
                <Text style={[styles.badgeStatusTexto, gpsIsMocked && styles.badgeStatusTextoFraude]}>
                  {gpsIsMocked ? 'GPS BLOQUEADO' : 'EM ROTA'}
                </Text>
              </View>
              <Text style={styles.nomeCliente} numberOfLines={1}>
                {clienteSelecionado?.nome || 'Nenhum cliente selecionado'}
              </Text>
            </View>

            <View style={styles.separador} />

            {/* adiciona rolagem para evitar corte do botao vermelho */}
            {/* ativa scroll aninhado no bottom sheet */}
            <ScrollView
              contentContainerStyle={{ paddingBottom: 60 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
              {/* alerta de fraude: exibido quando gps simulado e detectado */}
              {gpsIsMocked && (
                <View style={styles.alertaFraude}>
                  <Text style={styles.alertaFraudeTexto}>
                    Localizacao simulada detectada. O registro de visita foi bloqueado
                    por politica de auditoria.
                  </Text>
                </View>
              )}

              {/* informacoes do cliente selecionado */}
              <View style={styles.blocoInfo}>

                <View style={styles.linhaInfo}>
                  <Text style={styles.linhaInfoRotulo}>Servico</Text>
                  <View style={{
                    backgroundColor: clienteSelecionado?.status ? COR_RELATORIO[clienteSelecionado.status] : '#3b82f6',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}>
                    <Text style={[styles.linhaInfoValor, { color: '#ffffff', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase' }]}>
                      {clienteSelecionado?.servico}
                    </Text>
                  </View>
                </View>

                <View style={styles.linhaInfo}>
                  <Text style={styles.linhaInfoRotulo}>Endereco</Text>
                  <Text style={styles.linhaInfoValor}>{clienteSelecionado?.endereco}</Text>
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
                      // destaque em verde quando dentro da geofence
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

              {/* botao de navegacao externa com selecao de app via alert nativo */}
              <TouchableOpacity
                style={styles.botaoNavegar}
                activeOpacity={0.8}
                onPress={abrirNavegacao}
              >
                <Text style={styles.botaoNavegarTexto}>Navegar</Text>
              </TouchableOpacity>

              {/* secao de acoes da gaveta */}
              {renderAcoesAtendimento()}

              {/* troca rapida de cliente na rota */}
              {clienteSelecionado && clientes.filter((c) => c.id !== clienteSelecionado.id).length > 0 && (
                <>
                  <Text style={styles.seletorTitulo}>Outros clientes na rota</Text>
                  {clientes
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

      {/* renderiza a lista sobreposta ao mapa */}
      {mostrarLista && (
        <Modal visible={mostrarLista} animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Lista de Clientes</Text>
              <TouchableOpacity onPress={() => setMostrarLista(false)}>
                <Text style={styles.modalClose}>Voltar ao Mapa</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={clientes}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              nestedScrollEnabled={true}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefreshClientes}
                  colors={['#1d4ed8']}
                  tintColor="#1d4ed8"
                />
              }
              renderItem={({ item }) => (
                <View style={styles.modalCard}>
                  <Text style={styles.modalCardTitle}>{item.nome}</Text>
                  <Text style={styles.modalCardAddress}>{item.endereco}</Text>
                  <TouchableOpacity
                    style={styles.modalCardButton}
                    onPress={() => {
                      selecionarCliente(item);
                      setMostrarLista(false);
                    }}
                  >
                    <Text style={styles.modalCardButtonText}>Selecionar</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// estilos
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },

  // mapa em tela cheia — gaveta sobreposta via animated.view absoluta
  mapa: {
    flex: 1,
  },

  // indicador de gps: topo esquerdo, com margem para o botao de atualizar gps
  indicadorGps: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 120, // margem para o botao atualizar gps
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

  // botao de atualizacao manual do gps: canto superior direito
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

  // gaveta: animated.view absoluta no rodape, altura fixa para calculo de snap
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

  // alca de arrasto: area que recebe os handlers do panresponder
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

  // alerta de fraude: exibido quando gps simulado e detectado
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

  // destaque verde para distancia dentro da geofence
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

  // botao confirmar chegada: azul quando habilitado, cinza quando bloqueado
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

  // texto menor para mensagens de bloqueio mais longas
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

  // card exibido apos o registro do relatorio (estado final da tela)
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

  // garante que o campo tenha borda e altura para ser clicavel
  inputObservacao: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f8fafc',
    marginTop: 10,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#334155',
    marginBottom: 16,
  },

  botaoCancelarSecundario: {
    paddingVertical: 12,
    alignItems: 'center',
  },

  botaoCancelarSecundarioTexto: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },

  modalClose: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },

  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  modalCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },

  modalCardAddress: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },

  modalCardButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },

  modalCardButtonText: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '600',
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

