'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useNotificationStore } from '@/stores/notificationStore';

interface StoreProviderProps {
  children: React.ReactNode;
}

export function StoreProvider({ children }: StoreProviderProps) {
  const authStore = useAuthStore();
  const uiStore = useUIStore();
  const notificationStore = useNotificationStore();

  useEffect(() => {
    // Initialize auth store from token if available
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      if (token && !authStore.isAuthenticated) {
        authStore.setLoading(true);
        try {
          await authStore.hydrateFromToken(token);
        } catch (error) {
          console.error('Failed to initialize auth state:', error);
          authStore.logout();
        }
      }
    };

    // Initialize UI store with system preferences
    const initializeUI = () => {
      // Set up theme detection
      if (uiStore.theme === 'system') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = () => {
          document.documentElement.classList.toggle('dark', mediaQuery.matches);
        };

        handleThemeChange(); // Initial setup
        mediaQuery.addEventListener('change', handleThemeChange);

        return () => mediaQuery.removeEventListener('change', handleThemeChange);
      } else {
        document.documentElement.classList.toggle('dark', uiStore.theme === 'dark');
      }

      // Set up responsive breakpoint detection
      const updateScreenSize = () => {
        const width = window.innerWidth;
        let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'lg';

        if (width < 640) size = 'xs';
        else if (width < 768) size = 'sm';
        else if (width < 1024) size = 'md';
        else if (width < 1280) size = 'lg';
        else size = 'xl';

        uiStore.setScreenSize(size);
      };

      updateScreenSize(); // Initial setup
      window.addEventListener('resize', updateScreenSize);

      return () => window.removeEventListener('resize', updateScreenSize);
    };

    // Initialize notification store
    const initializeNotifications = () => {
      // Check for push notification support
      if ('Notification' in window) {
        notificationStore.setPushSupport(true);
        notificationStore.setPushPermission(Notification.permission);
      }

      // Set up service worker for push notifications
      if ('serviceWorker' in navigator && notificationStore.settings.pushEnabled) {
        navigator.serviceWorker.ready
          .then((registration) => {
            notificationStore.subscribeToPush(registration);
          })
          .catch((error) => {
            console.error('Service worker registration failed:', error);
          });
      }

      // Clean up expired notifications periodically
      const cleanupInterval = setInterval(() => {
        notificationStore.cleanup();
      }, 5 * 60 * 1000); // Every 5 minutes

      return () => clearInterval(cleanupInterval);
    };

    // Initialize all stores
    const cleanup: Array<(() => void) | undefined> = [];

    initializeAuth();
    cleanup.push(initializeUI());
    cleanup.push(initializeNotifications());

    // Cleanup function
    return () => {
      cleanup.forEach((fn) => fn?.());
    };
  }, [authStore, uiStore, notificationStore]);

  // Set up global error handling for stores
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);

      // Add error notification
      notificationStore.addNotification({
        type: 'system',
        title: 'Application Error',
        message: 'An unexpected error occurred. Please try again.',
        priority: 'medium',
        actionRequired: false,
        channels: ['in_app'],
      });
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);

      // Add error notification for critical errors
      if (event.error && !event.error.message?.includes('ResizeObserver')) {
        notificationStore.addNotification({
          type: 'system',
          title: 'Application Error',
          message: 'A system error occurred. Please refresh the page if problems persist.',
          priority: 'high',
          actionRequired: false,
          channels: ['in_app'],
        });
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [notificationStore]);

  // Set up visibility change handler for connection status
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, potentially disconnect
        notificationStore.setConnected(false);
      } else {
        // Page is visible, reconnect
        notificationStore.setConnected(true);
        notificationStore.resetRetries();

        // Refresh auth session if needed
        if (authStore.isAuthenticated && !authStore.checkSessionValidity()) {
          const token = localStorage.getItem('token');
          if (token) {
            authStore.hydrateFromToken(token);
          } else {
            authStore.logout();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [authStore, notificationStore]);

  // Set up online/offline detection
  useEffect(() => {
    const handleOnline = () => {
      notificationStore.setConnected(true);
      notificationStore.resetRetries();

      // Show reconnection notification
      notificationStore.addNotification({
        type: 'system',
        title: 'Back Online',
        message: 'Your connection has been restored.',
        priority: 'low',
        actionRequired: false,
        channels: ['in_app'],
        data: { autoClose: true },
      });
    };

    const handleOffline = () => {
      notificationStore.setConnected(false);

      // Show offline notification
      notificationStore.addNotification({
        type: 'system',
        title: 'Connection Lost',
        message: 'You are currently offline. Some features may be unavailable.',
        priority: 'medium',
        actionRequired: false,
        channels: ['in_app'],
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial connection state
    notificationStore.setConnected(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [notificationStore]);

  // Session timeout warning
  useEffect(() => {
    if (!authStore.isAuthenticated) return;

    const checkSessionTimeout = () => {
      if (!authStore.checkSessionValidity()) {
        authStore.logout();
        notificationStore.addNotification({
          type: 'system',
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again.',
          priority: 'medium',
          actionRequired: false,
          channels: ['in_app'],
        });
        return;
      }

      // Warn 15 minutes before session expires
      const sessionExpiry = authStore.sessionExpiry;
      if (sessionExpiry) {
        const timeUntilExpiry = sessionExpiry - Date.now();
        const fifteenMinutes = 15 * 60 * 1000;

        if (timeUntilExpiry <= fifteenMinutes && timeUntilExpiry > 0) {
          notificationStore.addNotification({
            type: 'system',
            title: 'Session Expiring Soon',
            message: 'Your session will expire in 15 minutes. Please save your work.',
            priority: 'medium',
            actionRequired: false,
            channels: ['in_app'],
            actions: [
              {
                id: 'extend',
                label: 'Extend Session',
                action: () => {
                  // Refresh session by making an authenticated request
                  const token = localStorage.getItem('token');
                  if (token) {
                    authStore.hydrateFromToken(token);
                  }
                },
                variant: 'primary',
              },
            ],
          });
        }
      }
    };

    // Check session every minute
    const sessionInterval = setInterval(checkSessionTimeout, 60 * 1000);

    return () => clearInterval(sessionInterval);
  }, [authStore.isAuthenticated, authStore.sessionExpiry, authStore, notificationStore]);

  return <>{children}</>;
}

// Hook to use multiple stores at once
export function useStores() {
  const authStore = useAuthStore();
  const uiStore = useUIStore();
  const notificationStore = useNotificationStore();

  return {
    auth: authStore,
    ui: uiStore,
    notifications: notificationStore,
  };
}

// Hook for hydrating stores from server-side data
export function useHydrateStores(initialData?: {
  auth?: any;
  ui?: any;
  notifications?: any;
}) {
  const stores = useStores();

  useEffect(() => {
    if (initialData?.auth) {
      // Hydrate auth store
      if (initialData.auth.user && initialData.auth.token) {
        stores.auth.login(initialData.auth.user, initialData.auth.token);
      }
    }

    if (initialData?.ui) {
      // Hydrate UI preferences
      stores.ui.updatePreferences(initialData.ui.preferences);
    }

    if (initialData?.notifications) {
      // Hydrate notification settings
      stores.notifications.updateSettings(initialData.notifications.settings);
    }
  }, [initialData, stores]);

  return stores;
}