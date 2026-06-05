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

// Track whether a token refresh is already in progress to avoid parallel refresh calls
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    // Attempt token refresh on 401, but only once per request and not for the refresh endpoint itself
    if (
      error?.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      const { refreshToken, setSession, logout } = useAuthStore.getState();

      if (!refreshToken) {
        logout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        setSession(data);
        processQueue(null, data.access_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
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
