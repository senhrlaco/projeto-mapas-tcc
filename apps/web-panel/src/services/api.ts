import axios from 'axios';

const urlConfigurada = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export const api = axios.create({
  // adiciona prefixo global da api para alinhar com o backend
  baseURL: `${urlConfigurada}/api`,
});

// intercepta e anexa o token atualizado em cada chamada
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@Savez:token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});
