// Auth Components
export { LoginForm } from './components/LoginForm';
export { RegisterForm } from './components/RegisterForm';

// Auth Hooks
export { useAuthGuard, useCustomerGuard, useBarberGuard, useAdminGuard, useGuestGuard } from './hooks/useAuthGuard';

// Auth Utils
export {
  getUserDisplayName,
  getUserInitials,
  hasPermission,
  canAccessResource,
  getDefaultRedirectUrl,
  isProfileComplete,
  getUserAvatar,
  formatUserRole,
  validatePassword,
  generatePassword,
  validateEmail,
  formatPhoneNumber,
  parseJWTPayload,
  isTokenExpired,
} from './utils/authUtils';

// Re-export base auth hooks for convenience
export {
  useCurrentUser,
  useLogin,
  useRegister,
  useLogout,
  usePasswordReset,
  useUpdateProfile,
  authKeys,
} from '@/hooks/auth/useAuth';

// Re-export auth store
export { useAuthStore, useAuthSelectors, authSelectors } from '@/stores/authStore';