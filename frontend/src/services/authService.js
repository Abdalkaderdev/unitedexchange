import api, { tokenManager, performLogout } from './api';

export const authService = {
  login: async (username, password) => {
    const response = await api.post('/auth/login', { username, password });

    if (response.data.success) {
      const { accessToken, refreshToken, expiresIn, user } = response.data.data;

      // Handle both old format (token) and new format (accessToken, refreshToken)
      const token = accessToken || response.data.data.token;

      // Store tokens using tokenManager
      tokenManager.setTokens(token, refreshToken, expiresIn);

      // Store user data separately
      localStorage.setItem('user', JSON.stringify(user));
    }

    return response.data;
  },

  logout: async () => {
    await performLogout();
  },

  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/auth/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated: () => {
    const token = tokenManager.getAccessToken();
    if (!token) return false;

    // Check if token is expired
    if (tokenManager.isTokenExpired()) {
      return false;
    }

    return true;
  },

  // Get token expiry info for display purposes
  getTokenExpiryInfo: () => {
    const expiry = tokenManager.getTokenExpiry();
    if (!expiry) return null;

    const now = Date.now();
    const remainingMs = expiry - now;

    return {
      expiresAt: new Date(expiry),
      remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
      remainingMinutes: Math.max(0, Math.floor(remainingMs / 60000)),
      isExpired: remainingMs <= 0,
      isExpiringSoon: tokenManager.isTokenExpiringSoon(2)
    };
  }
};

export default authService;
