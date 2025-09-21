import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface Notification {
  id: string;
  type: 'booking' | 'payment' | 'review' | 'system' | 'marketing' | 'reminder';
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  actionRequired: boolean;
  actions?: Array<{
    id: string;
    label: string;
    url?: string;
    action?: () => void;
    variant?: 'primary' | 'secondary' | 'destructive';
  }>;
  createdAt: string;
  expiresAt?: string;
  channels: Array<'push' | 'email' | 'sms' | 'in_app'>;
  metadata?: {
    bookingId?: string;
    barberId?: string;
    userId?: string;
    paymentId?: string;
    reviewId?: string;
  };
}

interface NotificationState {
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  lastChecked: string | null;

  // Settings
  settings: {
    enabled: boolean;
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;

    // Notification types
    bookingReminders: boolean;
    bookingConfirmations: boolean;
    bookingCancellations: boolean;
    paymentConfirmations: boolean;
    reviewRequests: boolean;
    promotions: boolean;
    systemUpdates: boolean;

    // Timing preferences
    reminderTime: number; // hours before appointment
    quietHours: {
      enabled: boolean;
      start: string; // HH:mm format
      end: string; // HH:mm format
    };
  };

  // Push notification support
  pushSupported: boolean;
  pushPermission: NotificationPermission;
  serviceWorkerRegistration: ServiceWorkerRegistration | null;

  // Real-time connection
  connected: boolean;
  lastConnectionTime: string | null;
  connectionRetries: number;
  maxRetries: number;

  // Notification history and analytics
  dismissedNotifications: string[];
  clickedNotifications: string[];
  notificationStats: {
    totalReceived: number;
    totalClicked: number;
    totalDismissed: number;
  };
}

interface NotificationActions {
  // Notification CRUD
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  clearExpired: () => void;

  // Batch operations
  markMultipleAsRead: (ids: string[]) => void;
  removeMultiple: (ids: string[]) => void;
  getNotificationsByType: (type: Notification['type']) => Notification[];
  getUnreadNotifications: () => Notification[];

  // Settings
  updateSettings: (updates: Partial<NotificationState['settings']>) => void;
  toggleNotifications: () => void;
  toggleNotificationType: (type: keyof NotificationState['settings']) => void;

  // Push notifications
  requestPushPermission: () => Promise<boolean>;
  subscribeToPush: (registration: ServiceWorkerRegistration) => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
  setPushSupport: (supported: boolean) => void;
  setPushPermission: (permission: NotificationPermission) => void;

  // Real-time connection
  setConnected: (connected: boolean) => void;
  incrementRetries: () => void;
  resetRetries: () => void;
  updateLastConnection: () => void;

  // Analytics
  trackNotificationClick: (id: string) => void;
  trackNotificationDismiss: (id: string) => void;
  getNotificationStats: () => NotificationState['notificationStats'];

  // Utility
  reset: () => void;
  cleanup: () => void;
}

type NotificationStore = NotificationState & NotificationActions;

const defaultSettings: NotificationState['settings'] = {
  enabled: true,
  pushEnabled: true,
  emailEnabled: true,
  smsEnabled: false,
  bookingReminders: true,
  bookingConfirmations: true,
  bookingCancellations: true,
  paymentConfirmations: true,
  reviewRequests: true,
  promotions: false,
  systemUpdates: true,
  reminderTime: 24, // 24 hours before
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
};

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  lastChecked: null,
  settings: defaultSettings,
  pushSupported: false,
  pushPermission: 'default',
  serviceWorkerRegistration: null,
  connected: false,
  lastConnectionTime: null,
  connectionRetries: 0,
  maxRetries: 3,
  dismissedNotifications: [],
  clickedNotifications: [],
  notificationStats: {
    totalReceived: 0,
    totalClicked: 0,
    totalDismissed: 0,
  },
};

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Add new notification
        addNotification: (notification) => {
          const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const now = new Date().toISOString();

          set((state) => {
            const newNotification: Notification = {
              ...notification,
              id,
              createdAt: now,
              read: false,
            };

            state.notifications.unshift(newNotification);
            state.unreadCount += 1;
            state.notificationStats.totalReceived += 1;

            // Keep only last 100 notifications
            if (state.notifications.length > 100) {
              state.notifications = state.notifications.slice(0, 100);
            }
          });

          // Show browser notification if supported and enabled
          const state = get();
          if (state.pushSupported && state.pushPermission === 'granted' && state.settings.pushEnabled) {
            new Notification(notification.title, {
              body: notification.message,
              icon: '/icon-192x192.png',
              badge: '/icon-72x72.png',
              tag: id,
              data: notification.data,
            });
          }

          return id;
        },

        // Mark notification as read
        markAsRead: (id) =>
          set((state) => {
            const notification = state.notifications.find((n) => n.id === id);
            if (notification && !notification.read) {
              notification.read = true;
              state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
          }),

        // Mark all notifications as read
        markAllAsRead: () =>
          set((state) => {
            state.notifications.forEach((notification) => {
              notification.read = true;
            });
            state.unreadCount = 0;
            state.lastChecked = new Date().toISOString();
          }),

        // Remove notification
        removeNotification: (id) =>
          set((state) => {
            const index = state.notifications.findIndex((n) => n.id === id);
            if (index !== -1) {
              const notification = state.notifications[index];
              if (notification && !notification.read) {
                state.unreadCount = Math.max(0, state.unreadCount - 1);
              }
              state.notifications.splice(index, 1);
            }
          }),

        // Clear all notifications
        clearNotifications: () =>
          set((state) => {
            state.notifications = [];
            state.unreadCount = 0;
          }),

        // Clear expired notifications
        clearExpired: () => {
          const now = new Date().toISOString();
          set((state) => {
            state.notifications = state.notifications.filter((notification) => {
              if (!notification.expiresAt) return true;
              return notification.expiresAt > now;
            });

            // Recalculate unread count
            state.unreadCount = state.notifications.filter((n) => !n.read).length;
          });
        },

        // Batch mark as read
        markMultipleAsRead: (ids) =>
          set((state) => {
            ids.forEach((id) => {
              const notification = state.notifications.find((n) => n.id === id);
              if (notification && !notification.read) {
                notification.read = true;
                state.unreadCount = Math.max(0, state.unreadCount - 1);
              }
            });
          }),

        // Batch remove
        removeMultiple: (ids) =>
          set((state) => {
            ids.forEach((id) => {
              const index = state.notifications.findIndex((n) => n.id === id);
              if (index !== -1) {
                const notification = state.notifications[index];
                if (notification && !notification.read) {
                  state.unreadCount = Math.max(0, state.unreadCount - 1);
                }
                state.notifications.splice(index, 1);
              }
            });
          }),

        // Get notifications by type
        getNotificationsByType: (type) => {
          const state = get();
          return state.notifications.filter((n) => n.type === type);
        },

        // Get unread notifications
        getUnreadNotifications: () => {
          const state = get();
          return state.notifications.filter((n) => !n.read);
        },

        // Update settings
        updateSettings: (updates) =>
          set((state) => {
            Object.assign(state.settings, updates);
          }),

        // Toggle all notifications
        toggleNotifications: () =>
          set((state) => {
            state.settings.enabled = !state.settings.enabled;
          }),

        // Toggle specific notification type
        toggleNotificationType: (type) =>
          set((state) => {
            if (type in state.settings) {
              (state.settings as any)[type] = !(state.settings as any)[type];
            }
          }),

        // Request push permission
        requestPushPermission: async () => {
          if (!('Notification' in window)) {
            set((state) => {
              state.pushSupported = false;
            });
            return false;
          }

          try {
            const permission = await Notification.requestPermission();
            set((state) => {
              state.pushPermission = permission;
              state.pushSupported = true;
            });
            return permission === 'granted';
          } catch (error) {
            console.error('Failed to request push permission:', error);
            return false;
          }
        },

        // Subscribe to push notifications
        subscribeToPush: async (registration) => {
          try {
            set((state) => {
              state.serviceWorkerRegistration = registration;
            });

            // Additional push subscription logic would go here
            // (e.g., sending subscription to server)
          } catch (error) {
            console.error('Failed to subscribe to push:', error);
          }
        },

        // Unsubscribe from push
        unsubscribeFromPush: async () => {
          try {
            const state = get();
            if (state.serviceWorkerRegistration) {
              const subscription = await state.serviceWorkerRegistration.pushManager.getSubscription();
              if (subscription) {
                await subscription.unsubscribe();
              }
            }

            set((draft) => {
              draft.serviceWorkerRegistration = null;
            });
          } catch (error) {
            console.error('Failed to unsubscribe from push:', error);
          }
        },

        // Set push support
        setPushSupport: (supported) =>
          set((state) => {
            state.pushSupported = supported;
          }),

        // Set push permission
        setPushPermission: (permission) =>
          set((state) => {
            state.pushPermission = permission;
          }),

        // Connection management
        setConnected: (connected) =>
          set((state) => {
            state.connected = connected;
            if (connected) {
              state.connectionRetries = 0;
              state.lastConnectionTime = new Date().toISOString();
            }
          }),

        incrementRetries: () =>
          set((state) => {
            state.connectionRetries += 1;
          }),

        resetRetries: () =>
          set((state) => {
            state.connectionRetries = 0;
          }),

        updateLastConnection: () =>
          set((state) => {
            state.lastConnectionTime = new Date().toISOString();
          }),

        // Analytics
        trackNotificationClick: (id) =>
          set((state) => {
            if (!state.clickedNotifications.includes(id)) {
              state.clickedNotifications.push(id);
              state.notificationStats.totalClicked += 1;
            }
          }),

        trackNotificationDismiss: (id) =>
          set((state) => {
            if (!state.dismissedNotifications.includes(id)) {
              state.dismissedNotifications.push(id);
              state.notificationStats.totalDismissed += 1;
            }
          }),

        getNotificationStats: () => {
          const state = get();
          return state.notificationStats;
        },

        // Cleanup expired notifications periodically
        cleanup: () => {
          get().clearExpired();
        },

        // Reset store
        reset: () => set(initialState),
      })),
      {
        name: 'notification-store',
        // Persist settings and some state
        partialize: (state) => ({
          settings: state.settings,
          dismissedNotifications: state.dismissedNotifications.slice(-50), // Keep last 50
          clickedNotifications: state.clickedNotifications.slice(-50), // Keep last 50
          notificationStats: state.notificationStats,
        }),
      }
    ),
    {
      name: 'notification-store',
    }
  )
);

// Selectors for common notification checks
export const notificationSelectors = {
  hasUnread: (state: NotificationStore) => state.unreadCount > 0,
  urgentNotifications: (state: NotificationStore) =>
    state.notifications.filter((n) => n.priority === 'urgent' && !n.read),
  actionRequiredNotifications: (state: NotificationStore) =>
    state.notifications.filter((n) => n.actionRequired && !n.read),
  isConnected: (state: NotificationStore) => state.connected,
  canReceivePush: (state: NotificationStore) =>
    state.pushSupported && state.pushPermission === 'granted' && state.settings.pushEnabled,
} as const;