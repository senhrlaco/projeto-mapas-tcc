
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// url da api — definir IP correto para dispositivo fisico
const API_URL = 'http://SEU_IP_LOCAL:3333/api/auth/login';

export default function LoginScreen({ navigation }: Props) {
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleEntrar = async () => {
    if (!username.trim() || !senha.trim()) {
      Alert.alert('Campos obrigatorios', 'Preencha o usuario e a senha.');
      return;
    }

    setCarregando(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: senha }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Erro', 'Credenciais invalidas');
        return;
      }

      await SecureStore.setItemAsync('token', data.token);

      navigation.navigate('Checkin', {
        userId: data.id ?? username,
        clientId: 'cliente-contabilidade-alpha',
        clientName: 'Contabilidade Alpha',
      });

    } catch {
      Alert.alert('Erro', 'Nao foi possivel conectar ao servidor.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.card}>
        <Text style={styles.empresa}>Savez Logistica</Text>
        <Text style={styles.titulo}>Painel do Agente</Text>
        <Text style={styles.subtitulo}>Acesso restrito a colaboradores cadastrados</Text>

        <Text style={styles.label}>Usuario</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: lucas.mello"
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          editable={!carregando}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Sua senha de acesso"
          placeholderTextColor="#9ca3af"
          secureTextEntry
          value={senha}
          onChangeText={setSenha}
          editable={!carregando}
        />

        <TouchableOpacity
          style={[styles.botao, carregando && styles.botaoDesabilitado]}
          onPress={handleEntrar}
          activeOpacity={0.8}
          disabled={carregando}
        >
          {carregando ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.botaoTexto}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  empresa: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  titulo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitulo: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 18,
  },
  botao: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botaoDesabilitado: {
    backgroundColor: '#93b4f5',
  },
  botaoTexto: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
