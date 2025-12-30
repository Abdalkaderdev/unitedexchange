import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import authService from '../services/authService';
import { tokenManager, performTokenRefresh } from '../services/api';

const AuthContext = createContext(null);

// Token refresh interval in milliseconds (1 minute)
const TOKEN_CHECK_INTERVAL = 60 * 1000;

// Threshold for refreshing token (2 minutes before expiry)
const TOKEN_REFRESH_THRESHOLD_MINUTES = 2;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshIntervalRef = useRef(null);
  const isRefreshingRef = useRef(false);

  // Initialize user from storage
  useEffect(() => {
    const initializeAuth = () => {
      const storedUser = authService.getCurrentUser();
      const isAuthenticated = authService.isAuthenticated();

      if (storedUser && isAuthenticated) {
        setUser(storedUser);
      } else if (storedUser && !isAuthenticated) {
        // Token expired, clear user
        tokenManager.clearTokens();
        setUser(null);
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  // Proactive token refresh function
  const checkAndRefreshToken = useCallback(async () => {
    // Skip if already refreshing or no user
    if (isRefreshingRef.current || !user) {
      return;
    }

    // Check if token exists and is expiring soon
    const accessToken = tokenManager.getAccessToken();
    if (!accessToken) {
      return;
    }

    const isExpiringSoon = tokenManager.isTokenExpiringSoon(TOKEN_REFRESH_THRESHOLD_MINUTES);

    if (isExpiringSoon) {
      isRefreshingRef.current = true;

      try {
        await performTokenRefresh();
        console.log('Token refreshed proactively');
      } catch (error) {
        console.error('Proactive token refresh failed:', error);
        // Don't logout here - let the 401 interceptor handle it
        // This allows the user to continue if they have a valid token
      } finally {
        isRefreshingRef.current = false;
      }
    }
  }, [user]);

  // Set up automatic token refresh interval
  useEffect(() => {
    if (user) {
      // Initial check
      checkAndRefreshToken();

      // Set up interval for periodic checks
      refreshIntervalRef.current = setInterval(() => {
        checkAndRefreshToken();
      }, TOKEN_CHECK_INTERVAL);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [user, checkAndRefreshToken]);

  // Listen for session expired events from API interceptor
  useEffect(() => {
    const handleSessionExpired = () => {
      console.log('Session expired event received');
      setUser(null);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };

    window.addEventListener('auth:sessionExpired', handleSessionExpired);

    return () => {
      window.removeEventListener('auth:sessionExpired', handleSessionExpired);
    };
  }, []);

  // Login function
  const login = async (username, password) => {
    const result = await authService.login(username, password);
    if (result.success) {
      setUser(result.data.user);
    }
    return result;
  };

  // Logout function
  const logout = async () => {
    // Clear refresh interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // Call logout API to invalidate refresh token
    await authService.logout();

    // Clear user state
    setUser(null);
  };

  // Check if user is admin
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  // Manual token refresh (can be called from components if needed)
  const refreshToken = async () => {
    if (isRefreshingRef.current) {
      return false;
    }

    isRefreshingRef.current = true;

    try {
      await performTokenRefresh();
      return true;
    } catch (error) {
      console.error('Manual token refresh failed:', error);
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  };

  // Get token expiry information
  const getTokenInfo = () => {
    return authService.getTokenExpiryInfo();
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAdmin,
    isAuthenticated: !!user,
    refreshToken,
    getTokenInfo
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
