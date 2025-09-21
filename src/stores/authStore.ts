import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { PublicUserProfile } from '@/lib/api/types/entities';

interface AuthState {
  // Authentication state
  user: PublicUserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Login/logout tracking
  loginAttempts: number;
  lastLoginAttempt: number | null;
  maxLoginAttempts: number;

  // Session management
  sessionExpiry: number | null;
  rememberMe: boolean;

  // Two-factor authentication
  twoFactorRequired: boolean;
  twoFactorToken: string | null;
}

interface AuthActions {
  // Authentication actions
  setUser: (user: PublicUserProfile | null) => void;
  setToken: (token: string | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setLoading: (isLoading: boolean) => void;

  // Login/logout actions
  login: (user: PublicUserProfile, token: string, rememberMe?: boolean) => void;
  logout: () => void;
  updateUser: (updates: Partial<PublicUserProfile>) => void;

  // Session management
  refreshSession: (token: string, expiresIn: number) => void;
  checkSessionValidity: () => boolean;
  clearSession: () => void;

  // Login attempt tracking
  incrementLoginAttempts: () => void;
  resetLoginAttempts: () => void;
  isLoginBlocked: () => boolean;

  // Two-factor authentication
  setTwoFactorRequired: (required: boolean, token?: string) => void;
  clearTwoFactor: () => void;

  // Utility actions
  reset: () => void;
  hydrateFromToken: (token: string) => Promise<boolean>;
}

type AuthStore = AuthState & AuthActions;

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  loginAttempts: 0,
  lastLoginAttempt: null,
  maxLoginAttempts: 5,
  sessionExpiry: null,
  rememberMe: false,
  twoFactorRequired: false,
  twoFactorToken: null,
};

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Set user
        setUser: (user) =>
          set((state) => {
            state.user = user;
          }),

        // Set token
        setToken: (token) =>
          set((state) => {
            state.token = token;
            if (token) {
              // Store in localStorage for API calls
              localStorage.setItem('token', token);
            } else {
              localStorage.removeItem('token');
            }
          }),

        // Set authentication status
        setAuthenticated: (isAuthenticated) =>
          set((state) => {
            state.isAuthenticated = isAuthenticated;
          }),

        // Set loading state
        setLoading: (isLoading) =>
          set((state) => {
            state.isLoading = isLoading;
          }),

        // Complete login flow
        login: (user, token, rememberMe = false) =>
          set((state) => {
            state.user = user;
            state.token = token;
            state.isAuthenticated = true;
            state.isLoading = false;
            state.rememberMe = rememberMe;
            state.loginAttempts = 0;
            state.lastLoginAttempt = null;
            state.twoFactorRequired = false;
            state.twoFactorToken = null;

            // Set session expiry (8 hours for remember me, 2 hours otherwise)
            const hoursToExpiry = rememberMe ? 8 : 2;
            state.sessionExpiry = Date.now() + hoursToExpiry * 60 * 60 * 1000;

            // Store token in localStorage
            localStorage.setItem('token', token);
          }),

        // Complete logout flow
        logout: () =>
          set((state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.sessionExpiry = null;
            state.twoFactorRequired = false;
            state.twoFactorToken = null;

            // Clear localStorage
            localStorage.removeItem('token');
          }),

        // Update user profile
        updateUser: (updates) =>
          set((state) => {
            if (state.user) {
              Object.assign(state.user, updates);
            }
          }),

        // Refresh session with new token
        refreshSession: (token, expiresIn) =>
          set((state) => {
            state.token = token;
            state.sessionExpiry = Date.now() + expiresIn * 1000;
            localStorage.setItem('token', token);
          }),

        // Check if current session is valid
        checkSessionValidity: () => {
          const state = get();
          if (!state.token || !state.sessionExpiry) return false;
          return Date.now() < state.sessionExpiry;
        },

        // Clear session data
        clearSession: () =>
          set((state) => {
            state.token = null;
            state.sessionExpiry = null;
            state.isAuthenticated = false;
            localStorage.removeItem('token');
          }),

        // Increment login attempts
        incrementLoginAttempts: () =>
          set((state) => {
            state.loginAttempts += 1;
            state.lastLoginAttempt = Date.now();
          }),

        // Reset login attempts
        resetLoginAttempts: () =>
          set((state) => {
            state.loginAttempts = 0;
            state.lastLoginAttempt = null;
          }),

        // Check if login is blocked due to too many attempts
        isLoginBlocked: () => {
          const state = get();
          if (state.loginAttempts < state.maxLoginAttempts) return false;

          // Block for 15 minutes after max attempts
          const blockDuration = 15 * 60 * 1000; // 15 minutes
          const blockExpiry = (state.lastLoginAttempt || 0) + blockDuration;

          if (Date.now() > blockExpiry) {
            // Block expired, reset attempts
            get().resetLoginAttempts();
            return false;
          }

          return true;
        },

        // Set two-factor authentication requirement
        setTwoFactorRequired: (required, token) =>
          set((state) => {
            state.twoFactorRequired = required;
            state.twoFactorToken = token || null;
          }),

        // Clear two-factor authentication state
        clearTwoFactor: () =>
          set((state) => {
            state.twoFactorRequired = false;
            state.twoFactorToken = null;
          }),

        // Reset entire store to initial state
        reset: () => set(initialState),

        // Hydrate store from existing token (for app initialization)
        hydrateFromToken: async (token) => {
          try {
            set((state) => {
              state.isLoading = true;
            });

            const response = await fetch('/api/auth/me', {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });

            if (!response.ok) {
              localStorage.removeItem('token');
              set((state) => {
                state.isLoading = false;
              });
              return false;
            }

            const data = await response.json();
            const user = data.data;

            set((state) => {
              state.user = user;
              state.token = token;
              state.isAuthenticated = true;
              state.isLoading = false;
              state.sessionExpiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours default
            });

            return true;
          } catch (error) {
            console.error('Failed to hydrate auth state:', error);
            localStorage.removeItem('token');
            set((state) => {
              state.isLoading = false;
            });
            return false;
          }
        },
      })),
      {
        name: 'auth-store',
        // Only persist certain fields, not sensitive data like tokens
        partialize: (state) => ({
          rememberMe: state.rememberMe,
          loginAttempts: state.loginAttempts,
          lastLoginAttempt: state.lastLoginAttempt,
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);

// Selectors for common auth checks
export const authSelectors = {
  isLoggedIn: (state: AuthStore) => state.isAuthenticated && !!state.user,
  isLoading: (state: AuthStore) => state.isLoading,
  user: (state: AuthStore) => state.user,
  userRole: (state: AuthStore) => state.user?.role,
  isBarber: (state: AuthStore) => state.user?.role === 'BARBER',
  isCustomer: (state: AuthStore) => state.user?.role === 'CUSTOMER',
  isAdmin: (state: AuthStore) => state.user?.role === 'ADMIN',
  requiresTwoFactor: (state: AuthStore) => state.twoFactorRequired,
  isLoginBlocked: (state: AuthStore) => state.isLoginBlocked(),
  sessionValid: (state: AuthStore) => state.checkSessionValidity(),
} as const;

// Hook for easy access to auth selectors
export const useAuthSelectors = () => {
  const store = useAuthStore();
  return {
    isLoggedIn: authSelectors.isLoggedIn(store),
    isLoading: authSelectors.isLoading(store),
    user: authSelectors.user(store),
    userRole: authSelectors.userRole(store),
    isBarber: authSelectors.isBarber(store),
    isCustomer: authSelectors.isCustomer(store),
    isAdmin: authSelectors.isAdmin(store),
    requiresTwoFactor: authSelectors.requiresTwoFactor(store),
    isLoginBlocked: authSelectors.isLoginBlocked(store),
    sessionValid: authSelectors.sessionValid(store),
  };
};