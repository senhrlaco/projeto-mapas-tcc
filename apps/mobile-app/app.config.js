// app.config.js — leitura dinâmica de variáveis de ambiente
// Este arquivo tem prioridade sobre app.json no Expo.
// Copie .env.example para .env e preencha os valores antes de rodar.

export default ({ config }) => ({
  ...config,
  name: config.name ?? 'Check-in Logístico',
  slug: config.slug ?? 'mobile-app',
  android: {
    ...config.android,
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
  },
});
