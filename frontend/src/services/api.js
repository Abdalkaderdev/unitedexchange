import axios from 'axios';

// Use relative URL in production, localhost in development
const API_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api');

// Token storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const TOKEN_EXPIRY_KEY = 'tokenExpiry';

// Token management utilities
export const tokenManager = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  getTokenExpiry: () => {
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    return expiry ? parseInt(expiry, 10) : null;
  },

  setTokens: (accessToken, refreshToken, expiresIn) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    if (expiresIn) {
      // Parse expiresIn - can be "15m", "1h", "7d" or number of seconds
      let expiryMs;
      if (typeof expiresIn === 'string') {
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (match) {
          const value = parseInt(match[1], 10);
          const unit = match[2];
          const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
          expiryMs = value * multipliers[unit];
        } else {
          // Fallback: assume seconds if just a number string
          expiryMs = parseInt(expiresIn, 10) * 1000;
        }
      } else {
        // Assume seconds if number
        expiryMs = expiresIn * 1000;
      }
      const expiryTime = Date.now() + expiryMs;
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    }
  },

  clearTokens: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem('user');
  },

  isTokenExpiringSoon: (thresholdMinutes = 2) => {
    const expiry = tokenManager.getTokenExpiry();
    if (!expiry) return false;
    const thresholdMs = thresholdMinutes * 60 * 1000;
    return (expiry - Date.now()) < thresholdMs;
  },

  isTokenExpired: () => {
    const expiry = tokenManager.getTokenExpiry();
    if (!expiry) return true;
    return Date.now() >= expiry;
  }
};

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Refresh token state management
let isRefreshing = false;
let failedQueue = [];

// Process queued requests after token refresh
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Refresh the access token
const refreshAccessToken = async () => {
  const refreshToken = tokenManager.getRefreshToken();

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  // Use a separate axios instance to avoid interceptor loops
  const response = await axios.post(`${API_URL}/auth/refresh`, {
    refreshToken
  });

  const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data.data;

  tokenManager.setTokens(accessToken, newRefreshToken, expiresIn);

  return accessToken;
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = tokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh if this is already a refresh request
      if (originalRequest.url?.includes('/auth/refresh') ||
          originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();

        // Process queued requests
        processQueue(null, newToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);

      } catch (refreshError) {
        // Refresh failed - clear tokens and redirect to login
        processQueue(refreshError, null);
        tokenManager.clearTokens();

        // Dispatch custom event for auth context to handle
        window.dispatchEvent(new CustomEvent('auth:sessionExpired'));

        // Redirect to login
        window.location.href = '/login';

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Export function to manually trigger token refresh (used by AuthContext)
export const performTokenRefresh = async () => {
  if (isRefreshing) {
    // Wait for the current refresh to complete
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    const newToken = await refreshAccessToken();
    processQueue(null, newToken);
    return newToken;
  } catch (error) {
    processQueue(error, null);
    throw error;
  } finally {
    isRefreshing = false;
  }
};

// Export function to logout (calls API to invalidate refresh token)
export const performLogout = async () => {
  const refreshToken = tokenManager.getRefreshToken();

  try {
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } catch (error) {
    // Log error but don't throw - we still want to clear local tokens
    console.error('Logout API call failed:', error);
  } finally {
    tokenManager.clearTokens();
  }
};

export default api;
