import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333/api',
});

// injeta o token jwt nas requisicoes do axios
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('@Savez:token');
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});
