
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
import { AxiosError } from 'axios';
import { api } from '../services/api';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // trava o fluxo se campos estiverem vazios
    if (!usuario.trim() || !senha.trim()) {
      Alert.alert('Campos obrigatorios', 'Preencha o usuario e a senha.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // sanitiza espacos vazios do usuario antes do envio
      const res = await api.post('/auth/login', {
        username: usuario.trim(),
        password: senha
      });

      const data = res.data;

      await SecureStore.setItemAsync('token', data.token);

      navigation.navigate('Checkin', {
        userId: data.id ?? usuario,
      });

    } catch (error: any) {
      const axiosError = error as AxiosError;
      
      if (axiosError.isAxiosError) {
        if (axiosError.response) {
          console.log('[LOGIN] Falha HTTP -> Status:', axiosError.response?.status);
          console.log('[LOGIN] Payload:', axiosError.response?.data);
        } else {
          console.log('[LOGIN] Falha de Rede -> Msg:', axiosError.message);
        }
      } else {
        console.log('[LOGIN] Falha Generica:', error);
      }
      
      Alert.alert('Erro', 'Nao foi possivel conectar ou credenciais invalidas.');
    } finally {
      setIsLoading(false);
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
          value={usuario}
          onChangeText={setUsuario}
          editable={!isLoading}
        />

        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Sua senha de acesso"
          placeholderTextColor="#9ca3af"
          secureTextEntry={true}
          value={senha}
          onChangeText={setSenha}
          editable={!isLoading}
        />

        {/* feedback visual de loading no botao */}
        <TouchableOpacity
          style={[styles.botao, isLoading && styles.botaoDesabilitado]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={isLoading}
        >
          {isLoading ? (
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
