import axios from 'axios';

const urlConfigurada = import.meta.env.VITE_API_URL || 'http://localhost:3333';

export const api = axios.create({
  // adiciona prefixo global da api para alinhar com o backend
  baseURL: `${urlConfigurada}/api`,
});

// injeta o token jwt nas requisicoes do axios
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@Savez:token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});
