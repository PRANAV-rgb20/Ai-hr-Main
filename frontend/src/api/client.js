import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// CRA: REACT_APP_BACKEND_URL — base host only (e.g. http://localhost:8000)
// Vite: VITE_API_URL — full API prefix (e.g. http://localhost:8000/api/v1)
const VITE_API = process.env.VITE_API_URL || '';
const REACT_BACKEND = process.env.REACT_APP_BACKEND_URL || '';
export const API_BASE = VITE_API || `${REACT_BACKEND.replace(/\/$/, '')}/api/v1`;

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      const { logout } = useAuthStore.getState();
      logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const formatApiError = (err) => {
  const data = err?.response?.data;
  if (data?.detail && typeof data.detail === 'string') return data.detail;
  const d = data?.detail;
  if (!d) return err?.message || 'Something went wrong';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(' ');
  return String(d);
};
