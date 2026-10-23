import axios, { AxiosError } from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  timeout: 10000,
});

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface CustomError extends Error {
  code?: string;
  status?: number;
  details?: unknown;
}

// Global response interceptor for consistent error extraction
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.data?.error) {
      const err: CustomError = new Error(error.response.data.error.message || 'API request failed');
      err.code = error.response.data.error.code;
      err.status = error.response.status;
      err.details = error.response.data.error.details;
      return Promise.reject(err);
    }
    const err: CustomError = new Error(error.message || 'Network communication error');
    err.status = error.response?.status;
    return Promise.reject(err);
  }
);

export default apiClient;
