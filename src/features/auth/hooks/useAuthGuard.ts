import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSelectors } from '@/stores/authStore';
import { useCurrentUser } from '@/hooks/auth/useAuth';

interface AuthGuardOptions {
  requireAuth?: boolean;
  requiredRole?: 'CUSTOMER' | 'BARBER' | 'ADMIN';
  redirectTo?: string;
  allowUnverified?: boolean;
  onUnauthorized?: () => void;
  loadingComponent?: React.ComponentType;
}

/**
 * Hook for protecting routes with authentication and authorization
 */
export function useAuthGuard({
  requireAuth = true,
  requiredRole,
  redirectTo,
  allowUnverified = false,
  onUnauthorized,
}: AuthGuardOptions = {}) {
  const router = useRouter();
  const { isLoggedIn, isLoading, user, userRole } = useAuthSelectors();
  const { isLoading: isUserLoading } = useCurrentUser();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading || isUserLoading) return;

    // Check if authentication is required
    if (requireAuth && !isLoggedIn) {
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        router.push(redirectTo || `/auth/login?returnUrl=${returnUrl}`);
      }
      return;
    }

    // Check if user is verified (if required)
    if (requireAuth && user && !allowUnverified && !user.isEmailVerified) {
      router.push(`/auth/verify-email?email=${encodeURIComponent(user.email)}`);
      return;
    }

    // Check role requirements
    if (requiredRole && userRole !== requiredRole) {
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        router.push('/unauthorized');
      }
      return;
    }
  }, [
    isLoggedIn,
    isLoading,
    isUserLoading,
    user,
    userRole,
    requireAuth,
    requiredRole,
    allowUnverified,
    redirectTo,
    onUnauthorized,
    router,
  ]);

  return {
    isAuthenticated: isLoggedIn,
    isLoading: isLoading || isUserLoading,
    user,
    userRole,
    hasRequiredRole: !requiredRole || userRole === requiredRole,
    isVerified: user?.isEmailVerified || false,
  };
}

/**
 * Hook for protecting customer-only routes
 */
export function useCustomerGuard(options?: Omit<AuthGuardOptions, 'requiredRole'>) {
  return useAuthGuard({
    ...options,
    requiredRole: 'CUSTOMER',
    redirectTo: options?.redirectTo || '/auth/login',
  });
}

/**
 * Hook for protecting barber-only routes
 */
export function useBarberGuard(options?: Omit<AuthGuardOptions, 'requiredRole'>) {
  return useAuthGuard({
    ...options,
    requiredRole: 'BARBER',
    redirectTo: options?.redirectTo || '/auth/login',
  });
}

/**
 * Hook for protecting admin-only routes
 */
export function useAdminGuard(options?: Omit<AuthGuardOptions, 'requiredRole'>) {
  return useAuthGuard({
    ...options,
    requiredRole: 'ADMIN',
    redirectTo: options?.redirectTo || '/auth/login',
  });
}

/**
 * Hook for guest-only routes (redirect authenticated users)
 */
export function useGuestGuard(redirectTo: string = '/dashboard') {
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuthSelectors();

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.push(redirectTo);
    }
  }, [isLoggedIn, isLoading, redirectTo, router]);

  return {
    isGuest: !isLoggedIn,
    isLoading,
  };
}