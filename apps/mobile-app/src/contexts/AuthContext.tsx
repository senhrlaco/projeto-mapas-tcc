import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

type User = {
  id: string;
  nome?: string;
  nivel?: string;
};

type AuthContextData = {
  user: User | null;
  isLoading: boolean;
  signIn: (token: string, userData: User) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStorageData() {
      try {
        // hidrata a sessao lendo o cache do celular
        const storagedUser = await AsyncStorage.getItem('@Savez:user');
        const storagedToken = await SecureStore.getItemAsync('token');

        if (storagedUser && storagedToken) {
          setUser(JSON.parse(storagedUser));
        }
      } catch (error) {
        console.error('Erro ao carregar dados do storage', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadStorageData();
  }, []);

  async function signIn(token: string, userData: User) {
    await SecureStore.setItemAsync('token', token);
    await AsyncStorage.setItem('@Savez:user', JSON.stringify(userData));
    setUser(userData);
  }

  async function signOut() {
    await AsyncStorage.clear();
    await SecureStore.deleteItemAsync('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  return context;
}
