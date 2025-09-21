'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';

interface SessionConfig {
  autoRefresh?: boolean;
  refreshThreshold?: number; // minutes before expiry to refresh
  maxRetries?: number;
  onSessionExpired?: () => void;
  onRefreshSuccess?: () => void;
  onRefreshError?: (error: Error) => void;
}

interface SessionInfo {
  isValid: boolean;
  isExpired: boolean;
  isNearExpiry: boolean;
  expiresAt: Date | null;
  timeUntilExpiry: number | null; // in milliseconds
  remainingTime: string | null; // formatted string
}

interface SessionManagerState {
  isRefreshing: boolean;
  lastRefreshAttempt: Date | null;
  refreshRetries: number;
  sessionInfo: SessionInfo;
}

export function useSession(config: SessionConfig = {}) {
  const {
    autoRefresh = true,
    refreshThreshold = 5, // 5 minutes
    maxRetries = 3,
    onSessionExpired,
    onRefreshSuccess,
    onRefreshError,
  } = config;

  const { token, user, logout } = useAuthStore();
  const router = useRouter();

  const [state, setState] = useState<SessionManagerState>({
    isRefreshing: false,
    lastRefreshAttempt: null,
    refreshRetries: 0,
    sessionInfo: {
      isValid: false,
      isExpired: false,
      isNearExpiry: false,
      expiresAt: null,
      timeUntilExpiry: null,
      remainingTime: null,
    },
  });

  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Parse JWT token to get expiration time
  const parseTokenExpiry = useCallback((jwtToken: string): Date | null => {
    try {
      const parts = jwtToken.split('.');
      if (parts.length !== 3 || !parts[1]) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }, []);

  // Format remaining time as human-readable string
  const formatRemainingTime = useCallback((milliseconds: number): string => {
    const totalMinutes = Math.floor(milliseconds / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      const seconds = Math.floor(milliseconds / 1000);
      return `${seconds}s`;
    }
  }, []);

  // Calculate session information
  const calculateSessionInfo = useCallback((currentToken: string | null): SessionInfo => {
    if (!currentToken) {
      return {
        isValid: false,
        isExpired: true,
        isNearExpiry: false,
        expiresAt: null,
        timeUntilExpiry: null,
        remainingTime: null,
      };
    }

    const expiresAt = parseTokenExpiry(currentToken);
    if (!expiresAt) {
      return {
        isValid: false,
        isExpired: true,
        isNearExpiry: false,
        expiresAt: null,
        timeUntilExpiry: null,
        remainingTime: null,
      };
    }

    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const isExpired = timeUntilExpiry <= 0;
    const isNearExpiry = timeUntilExpiry <= (refreshThreshold * 60 * 1000);
    const isValid = !isExpired;

    return {
      isValid,
      isExpired,
      isNearExpiry,
      expiresAt,
      timeUntilExpiry: isExpired ? 0 : timeUntilExpiry,
      remainingTime: isExpired ? null : formatRemainingTime(timeUntilExpiry),
    };
  }, [parseTokenExpiry, refreshThreshold, formatRemainingTime]);

  // Refresh token function
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (state.isRefreshing || !token) {
      return false;
    }

    setState(prev => ({ ...prev, isRefreshing: true }));

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // Update auth store with new token
      useAuthStore.getState().setToken(data.token);

      setState(prev => ({
        ...prev,
        isRefreshing: false,
        refreshRetries: 0,
        lastRefreshAttempt: new Date(),
      }));

      onRefreshSuccess?.();
      return true;
    } catch (error) {
      const newRetries = state.refreshRetries + 1;

      setState(prev => ({
        ...prev,
        isRefreshing: false,
        refreshRetries: newRetries,
        lastRefreshAttempt: new Date(),
      }));

      onRefreshError?.(error as Error);

      // If max retries exceeded, logout user
      if (newRetries >= maxRetries) {
        logout();
        onSessionExpired?.();
        router.push('/auth/login?reason=session_expired');
      }

      return false;
    }
  }, [token, state.isRefreshing, state.refreshRetries, maxRetries, logout, router, onRefreshSuccess, onRefreshError, onSessionExpired]);

  // Setup auto-refresh
  const setupAutoRefresh = useCallback((sessionInfo: SessionInfo) => {
    if (!autoRefresh || !sessionInfo.isValid || sessionInfo.isExpired) {
      return;
    }

    // Clear existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    // If near expiry, refresh immediately
    if (sessionInfo.isNearExpiry) {
      refreshToken();
      return;
    }

    // Otherwise, set timeout to refresh when near expiry
    const timeUntilRefresh = (sessionInfo.timeUntilExpiry || 0) - (refreshThreshold * 60 * 1000);

    if (timeUntilRefresh > 0) {
      refreshTimeoutRef.current = setTimeout(() => {
        refreshToken();
      }, timeUntilRefresh);
    }
  }, [autoRefresh, refreshThreshold, refreshToken]);

  // Update session info periodically
  useEffect(() => {
    const updateSessionInfo = () => {
      const sessionInfo = calculateSessionInfo(token);

      setState(prev => ({
        ...prev,
        sessionInfo,
      }));

      // Handle expired sessions
      if (sessionInfo.isExpired && token) {
        logout();
        onSessionExpired?.();
        router.push('/auth/login?reason=session_expired');
        return;
      }

      // Setup auto-refresh if needed
      setupAutoRefresh(sessionInfo);
    };

    // Initial calculation
    updateSessionInfo();

    // Update every minute
    intervalRef.current = setInterval(updateSessionInfo, 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [token, calculateSessionInfo, setupAutoRefresh, logout, router, onSessionExpired]);

  // Manual refresh function
  const manualRefresh = useCallback(async () => {
    return await refreshToken();
  }, [refreshToken]);

  // Check if user is authenticated
  const isAuthenticated = !!token && !!user && state.sessionInfo.isValid;

  // Force logout function
  const forceLogout = useCallback(() => {
    logout();
    router.push('/auth/login');
  }, [logout, router]);

  // Session activity tracking
  const updateLastActivity = useCallback(() => {
    // TODO: Implement activity tracking in AuthStore
    // useAuthStore.getState().updateLastActivity();
  }, []);

  // Auto-update activity on user interactions
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    const handleActivity = () => {
      updateLastActivity();
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [updateLastActivity]);

  return {
    // Session state
    isAuthenticated,
    sessionInfo: state.sessionInfo,
    isRefreshing: state.isRefreshing,
    refreshRetries: state.refreshRetries,
    lastRefreshAttempt: state.lastRefreshAttempt,

    // Actions
    refreshToken: manualRefresh,
    logout: forceLogout,
    updateActivity: updateLastActivity,

    // Session status helpers
    isExpired: state.sessionInfo.isExpired,
    isNearExpiry: state.sessionInfo.isNearExpiry,
    timeUntilExpiry: state.sessionInfo.timeUntilExpiry,
    remainingTime: state.sessionInfo.remainingTime,
    expiresAt: state.sessionInfo.expiresAt,
  };
}

// Hook for checking if user has specific permissions
export function usePermissions() {
  const { user } = useAuthStore();

  const hasRole = useCallback((role: string) => {
    return user?.role === role;
  }, [user?.role]);

  const hasAnyRole = useCallback((roles: string[]) => {
    return user?.role ? roles.includes(user.role) : false;
  }, [user?.role]);

  const isCustomer = hasRole('customer');
  const isBarber = hasRole('barber');
  const isAdmin = hasRole('admin');

  const canBookAppointments = isCustomer || isAdmin;
  const canManageBookings = isBarber || isAdmin;
  const canManageUsers = isAdmin;
  const canViewReports = isBarber || isAdmin;

  return {
    user,
    hasRole,
    hasAnyRole,
    isCustomer,
    isBarber,
    isAdmin,
    canBookAppointments,
    canManageBookings,
    canManageUsers,
    canViewReports,
  };
}

// Hook for checking authentication requirements
export function useAuthGuard(options: {
  requireAuth?: boolean;
  requireRoles?: string[];
  redirectTo?: string;
} = {}) {
  const { requireAuth = true, requireRoles = [], redirectTo = '/auth/login' } = options;
  const { isAuthenticated } = useSession();
  const { hasAnyRole } = usePermissions();
  const router = useRouter();

  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // If authentication is required but user is not authenticated
      if (requireAuth && !isAuthenticated) {
        router.push(redirectTo);
        return;
      }

      // If specific roles are required but user doesn't have them
      if (requireRoles.length > 0 && !hasAnyRole(requireRoles)) {
        router.push('/unauthorized');
        return;
      }

      setIsChecking(false);
    };

    checkAuth();
  }, [isAuthenticated, hasAnyRole, requireAuth, requireRoles, redirectTo, router]);

  return {
    isChecking,
    isAuthorized: !isChecking &&
      (!requireAuth || isAuthenticated) &&
      (requireRoles.length === 0 || hasAnyRole(requireRoles)),
  };
}