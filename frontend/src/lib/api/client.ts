/**
 * API Client Configuration
 * Base client for all API communications
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const API_TIMEOUT = 30000; // 30 seconds

/**
 * Create axios instance with default configuration
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies for authentication
});

/**
 * Request interceptor to add authentication token
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage or cookie
    const token = getAuthToken();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request ID for tracing
    const requestId = generateRequestId();
    config.headers['X-Request-ID'] = requestId;

    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 API Request [${requestId}]:`, {
        method: config.method?.toUpperCase(),
        url: config.url,
        baseURL: config.baseURL,
        headers: config.headers,
        data: config.data
      });
    }

    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response interceptor for error handling and token refresh
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      const requestId = response.config.headers['X-Request-ID'];
      console.log(`✅ API Response [${requestId}]:`, {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
    }

    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      const requestId = originalRequest?.headers['X-Request-ID'];
      console.error(`❌ API Error [${requestId}]:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        data: error.response?.data
      });
    }

    // Handle different error scenarios
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Unauthorized - try to refresh token
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
              await refreshAuthToken();
              const newToken = getAuthToken();
              
              if (newToken && originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return apiClient(originalRequest);
              }
            } catch (refreshError) {
              // Refresh failed, redirect to login
              handleAuthFailure();
              return Promise.reject(refreshError);
            }
          } else {
            // Retry failed, redirect to login
            handleAuthFailure();
          }
          break;

        case 403:
          // Forbidden - user doesn't have permission
          console.error('Access denied:', data.message);
          break;

        case 404:
          // Not found
          console.error('Resource not found:', originalRequest.url);
          break;

        case 429:
          // Rate limited
          console.error('Rate limit exceeded:', data.message);
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          // Server errors
          console.error('Server error:', data.message || 'Internal server error');
          break;

        default:
          console.error('API Error:', data.message || 'Unknown error');
      }

      // Transform error for better handling
      const apiError = new APIError(
        data.message || 'An error occurred',
        status,
        data.code,
        data.details
      );

      return Promise.reject(apiError);
    }

    // Network error or timeout
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new APIError('Request timeout', 0, 'TIMEOUT'));
    }

    if (error.message === 'Network Error') {
      return Promise.reject(new APIError('Network error - please check your connection', 0, 'NETWORK_ERROR'));
    }

    return Promise.reject(error);
  }
);

/**
 * Custom API Error class
 */
export class APIError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: any;

  constructor(message: string, status: number = 0, code?: string, details?: any) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Get authentication token from storage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try localStorage first
  const token = localStorage.getItem('auth_token');
  if (token) return token;
  
  // Try sessionStorage as fallback
  return sessionStorage.getItem('auth_token');
}

/**
 * Store authentication token
 */
export function setAuthToken(token: string, remember: boolean = true): void {
  if (typeof window === 'undefined') return;
  
  if (remember) {
    localStorage.setItem('auth_token', token);
  } else {
    sessionStorage.setItem('auth_token', token);
  }
}

/**
 * Remove authentication token
 */
export function removeAuthToken(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_token');
}

/**
 * Refresh authentication token
 */
async function refreshAuthToken(): Promise<void> {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
      withCredentials: true,
      timeout: 10000
    });
    
    const { token } = response.data;
    if (token) {
      setAuthToken(token);
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
}

/**
 * Handle authentication failure
 */
function handleAuthFailure(): void {
  removeAuthToken();
  
  // Redirect to login page
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
    
    // Use Next.js router if available, otherwise fallback to window.location
    if (window.location.pathname !== '/login') {
      window.location.href = loginUrl;
    }
  }
}

/**
 * Generate unique request ID for tracing
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * API client utilities
 */
export const apiUtils = {
  /**
   * Check if error is an API error
   */
  isAPIError(error: any): error is APIError {
    return error instanceof APIError;
  },

  /**
   * Get error message from various error types
   */
  getErrorMessage(error: any): string {
    if (error instanceof APIError) {
      return error.message;
    }
    
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    return 'An unexpected error occurred';
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!getAuthToken();
  },

  /**
   * Create form data from object
   */
  createFormData(data: Record<string, any>): FormData {
    const formData = new FormData();
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (value instanceof File) {
          formData.append(key, value);
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            formData.append(`${key}[${index}]`, item);
          });
        } else if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value));
        } else {
          formData.append(key, String(value));
        }
      }
    });
    
    return formData;
  },

  /**
   * Build query string from parameters
   */
  buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(item => searchParams.append(key, String(item)));
        } else {
          searchParams.append(key, String(value));
        }
      }
    });
    
    return searchParams.toString();
  },

  /**
   * Download file from blob response
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
};

export default apiClient;
