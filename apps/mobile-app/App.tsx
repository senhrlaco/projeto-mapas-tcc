// App.tsx
// Ponto de entrada do aplicativo.
//
// Hierarquia de providers:
//   NavigationContainer  — contexto de navegacao do React Navigation
//     Stack.Navigator    — pilha de telas tipada

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import CheckinScreen from './src/screens/CheckinScreen';

// Tipagem centralizada das rotas, exportada para uso nas props de cada tela.
export type RootStackParamList = {
  Login: undefined;
  Checkin: {
    userId: string;
    clientId: string;
    clientName: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />

      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#1d4ed8' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: 'Acesso ao Sistema' }}
        />

        {/* Header ocultado na tela de Checkin: o MapView ocupa a tela inteira. */}
        <Stack.Screen
          name="Checkin"
          component={CheckinScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}