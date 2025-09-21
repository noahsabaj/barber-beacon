import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface Toast {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'default' | 'destructive';
  }>;
}

interface Modal {
  id: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  options?: {
    closable?: boolean;
    backdrop?: boolean;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  };
}

interface UIState {
  // Theme and appearance
  theme: 'light' | 'dark' | 'system';
  sidebarOpen: boolean;
  compactMode: boolean;

  // Navigation and routing
  currentPage: string;
  previousPage: string | null;
  navigationHistory: string[];

  // Loading states
  globalLoading: boolean;
  pageLoading: boolean;
  componentLoading: Record<string, boolean>;

  // Toasts and notifications
  toasts: Toast[];
  maxToasts: number;

  // Modals and dialogs
  modals: Modal[];

  // Search and filters
  searchQuery: string;
  activeFilters: Record<string, any>;
  savedSearches: Array<{
    id: string;
    name: string;
    query: string;
    filters: Record<string, any>;
  }>;

  // Map and location
  mapView: 'list' | 'map' | 'split';
  mapZoom: number;
  mapCenter: { lat: number; lng: number } | null;
  userLocation: { lat: number; lng: number } | null;

  // Booking flow
  bookingStep: number;
  bookingData: Record<string, any>;

  // Mobile and responsive
  isMobile: boolean;
  screenSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  // Preferences
  preferences: {
    autoSave: boolean;
    notifications: boolean;
    emailUpdates: boolean;
    smsUpdates: boolean;
    marketingEmails: boolean;
    language: string;
    timezone: string;
    dateFormat: string;
    currency: string;
  };
}

interface UIActions {
  // Theme actions
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;

  // Sidebar actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Navigation actions
  setCurrentPage: (page: string) => void;
  goBack: () => void;
  addToHistory: (page: string) => void;

  // Loading actions
  setGlobalLoading: (loading: boolean) => void;
  setPageLoading: (loading: boolean) => void;
  setComponentLoading: (component: string, loading: boolean) => void;

  // Toast actions
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;

  // Modal actions
  openModal: (modal: Omit<Modal, 'id'>) => string;
  closeModal: (id: string) => void;
  closeAllModals: () => void;

  // Search actions
  setSearchQuery: (query: string) => void;
  setActiveFilters: (filters: Record<string, any>) => void;
  clearFilters: () => void;
  saveSearch: (name: string) => void;
  deleteSavedSearch: (id: string) => void;

  // Map actions
  setMapView: (view: 'list' | 'map' | 'split') => void;
  setMapZoom: (zoom: number) => void;
  setMapCenter: (center: { lat: number; lng: number }) => void;
  setUserLocation: (location: { lat: number; lng: number }) => void;

  // Booking flow actions
  setBookingStep: (step: number) => void;
  updateBookingData: (data: Partial<Record<string, any>>) => void;
  resetBookingFlow: () => void;

  // Responsive actions
  setScreenSize: (size: 'xs' | 'sm' | 'md' | 'lg' | 'xl') => void;
  setIsMobile: (isMobile: boolean) => void;

  // Preference actions
  updatePreferences: (updates: Partial<UIState['preferences']>) => void;
  resetPreferences: () => void;

  // Utility actions
  reset: () => void;
}

type UIStore = UIState & UIActions;

const defaultPreferences: UIState['preferences'] = {
  autoSave: true,
  notifications: true,
  emailUpdates: true,
  smsUpdates: false,
  marketingEmails: false,
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  dateFormat: 'MM/dd/yyyy',
  currency: 'USD',
};

const initialState: UIState = {
  theme: 'system',
  sidebarOpen: false,
  compactMode: false,
  currentPage: '/',
  previousPage: null,
  navigationHistory: ['/'],
  globalLoading: false,
  pageLoading: false,
  componentLoading: {},
  toasts: [],
  maxToasts: 5,
  modals: [],
  searchQuery: '',
  activeFilters: {},
  savedSearches: [],
  mapView: 'list',
  mapZoom: 12,
  mapCenter: null,
  userLocation: null,
  bookingStep: 1,
  bookingData: {},
  isMobile: false,
  screenSize: 'lg',
  preferences: defaultPreferences,
};

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Theme actions
        setTheme: (theme) =>
          set((state) => {
            state.theme = theme;
          }),

        toggleTheme: () =>
          set((state) => {
            state.theme = state.theme === 'light' ? 'dark' : 'light';
          }),

        // Sidebar actions
        setSidebarOpen: (open) =>
          set((state) => {
            state.sidebarOpen = open;
          }),

        toggleSidebar: () =>
          set((state) => {
            state.sidebarOpen = !state.sidebarOpen;
          }),

        // Navigation actions
        setCurrentPage: (page) =>
          set((state) => {
            state.previousPage = state.currentPage;
            state.currentPage = page;
          }),

        goBack: () => {
          const state = get();
          if (state.previousPage) {
            set((draft) => {
              draft.currentPage = state.previousPage!;
              draft.previousPage = null;
            });
          }
        },

        addToHistory: (page) =>
          set((state) => {
            state.navigationHistory.push(page);
            // Keep only last 10 pages
            if (state.navigationHistory.length > 10) {
              state.navigationHistory = state.navigationHistory.slice(-10);
            }
          }),

        // Loading actions
        setGlobalLoading: (loading) =>
          set((state) => {
            state.globalLoading = loading;
          }),

        setPageLoading: (loading) =>
          set((state) => {
            state.pageLoading = loading;
          }),

        setComponentLoading: (component, loading) =>
          set((state) => {
            if (loading) {
              state.componentLoading[component] = true;
            } else {
              delete state.componentLoading[component];
            }
          }),

        // Toast actions
        addToast: (toast) => {
          const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          set((state) => {
            const newToast: Toast = { ...toast, id };
            state.toasts.push(newToast);

            // Remove excess toasts
            if (state.toasts.length > state.maxToasts) {
              state.toasts = state.toasts.slice(-state.maxToasts);
            }
          });

          // Auto-remove toast after duration
          const duration = toast.duration || 5000;
          setTimeout(() => {
            get().removeToast(id);
          }, duration);

          return id;
        },

        removeToast: (id) =>
          set((state) => {
            state.toasts = state.toasts.filter((toast) => toast.id !== id);
          }),

        clearToasts: () =>
          set((state) => {
            state.toasts = [];
          }),

        // Modal actions
        openModal: (modal) => {
          const id = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          set((state) => {
            state.modals.push({ ...modal, id });
          });
          return id;
        },

        closeModal: (id) =>
          set((state) => {
            state.modals = state.modals.filter((modal) => modal.id !== id);
          }),

        closeAllModals: () =>
          set((state) => {
            state.modals = [];
          }),

        // Search actions
        setSearchQuery: (query) =>
          set((state) => {
            state.searchQuery = query;
          }),

        setActiveFilters: (filters) =>
          set((state) => {
            state.activeFilters = filters;
          }),

        clearFilters: () =>
          set((state) => {
            state.activeFilters = {};
            state.searchQuery = '';
          }),

        saveSearch: (name) => {
          const state = get();
          const id = `search-${Date.now()}`;
          set((draft) => {
            draft.savedSearches.push({
              id,
              name,
              query: state.searchQuery,
              filters: state.activeFilters,
            });
          });
        },

        deleteSavedSearch: (id) =>
          set((state) => {
            state.savedSearches = state.savedSearches.filter((search) => search.id !== id);
          }),

        // Map actions
        setMapView: (view) =>
          set((state) => {
            state.mapView = view;
          }),

        setMapZoom: (zoom) =>
          set((state) => {
            state.mapZoom = zoom;
          }),

        setMapCenter: (center) =>
          set((state) => {
            state.mapCenter = center;
          }),

        setUserLocation: (location) =>
          set((state) => {
            state.userLocation = location;
            if (!state.mapCenter) {
              state.mapCenter = location;
            }
          }),

        // Booking flow actions
        setBookingStep: (step) =>
          set((state) => {
            state.bookingStep = step;
          }),

        updateBookingData: (data) =>
          set((state) => {
            Object.assign(state.bookingData, data);
          }),

        resetBookingFlow: () =>
          set((state) => {
            state.bookingStep = 1;
            state.bookingData = {};
          }),

        // Responsive actions
        setScreenSize: (size) =>
          set((state) => {
            state.screenSize = size;
            state.isMobile = size === 'xs' || size === 'sm';
          }),

        setIsMobile: (isMobile) =>
          set((state) => {
            state.isMobile = isMobile;
          }),

        // Preference actions
        updatePreferences: (updates) =>
          set((state) => {
            Object.assign(state.preferences, updates);
          }),

        resetPreferences: () =>
          set((state) => {
            state.preferences = { ...defaultPreferences };
          }),

        // Reset store
        reset: () => set(initialState),
      })),
      {
        name: 'ui-store',
        // Persist user preferences and some UI state
        partialize: (state) => ({
          theme: state.theme,
          compactMode: state.compactMode,
          mapView: state.mapView,
          mapZoom: state.mapZoom,
          savedSearches: state.savedSearches,
          preferences: state.preferences,
        }),
      }
    ),
    {
      name: 'ui-store',
    }
  )
);

// Selectors for common UI state
export const uiSelectors = {
  isDarkMode: (state: UIStore) => {
    if (state.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return state.theme === 'dark';
  },
  hasActiveFilters: (state: UIStore) => Object.keys(state.activeFilters).length > 0,
  isLoading: (state: UIStore) => state.globalLoading || state.pageLoading,
  hasModals: (state: UIStore) => state.modals.length > 0,
  hasToasts: (state: UIStore) => state.toasts.length > 0,
} as const;