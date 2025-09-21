'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';

interface PasswordResetState {
  email: string;
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
  canResend: boolean;
  resendCooldown: number;
}

interface EmailVerificationState {
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
  canResend: boolean;
  resendCooldown: number;
}

interface AuthFlowState {
  redirectTo: string | null;
  returnUrl: string | null;
  authenticationReason: string | null;
}

// Password reset flow hook
export function usePasswordReset() {
  const [state, setState] = useState<PasswordResetState>({
    email: '',
    isLoading: false,
    isSuccess: false,
    error: null,
    canResend: true,
    resendCooldown: 0,
  });

  const router = useRouter();

  // Request password reset mutation
  const requestResetMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send reset email');
      }

      return response.json();
    },
    onMutate: (email) => {
      setState(prev => ({
        ...prev,
        email,
        isLoading: true,
        error: null,
      }));
    },
    onSuccess: () => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSuccess: true,
        canResend: false,
        resendCooldown: 60, // 60 seconds cooldown
      }));

      // Start cooldown timer
      const interval = setInterval(() => {
        setState(prev => {
          const newCooldown = prev.resendCooldown - 1;
          if (newCooldown <= 0) {
            clearInterval(interval);
            return {
              ...prev,
              resendCooldown: 0,
              canResend: true,
            };
          }
          return {
            ...prev,
            resendCooldown: newCooldown,
          };
        });
      }, 1000);
    },
    onError: (error: Error) => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to reset password');
      }

      return response.json();
    },
    onSuccess: () => {
      router.push('/auth/login?message=password_reset_success');
    },
  });

  const requestReset = useCallback((email: string) => {
    requestResetMutation.mutate(email);
  }, [requestResetMutation]);

  const resetPassword = useCallback((token: string, password: string) => {
    resetPasswordMutation.mutate({ token, password });
  }, [resetPasswordMutation]);

  const resendResetEmail = useCallback(() => {
    if (state.canResend && state.email) {
      requestReset(state.email);
    }
  }, [state.canResend, state.email, requestReset]);

  return {
    ...state,
    requestReset,
    resetPassword,
    resendResetEmail,
    isResetLoading: resetPasswordMutation.isPending,
    resetError: resetPasswordMutation.error?.message || null,
  };
}

// Email verification flow hook
export function useEmailVerification() {
  const [state, setState] = useState<EmailVerificationState>({
    isLoading: false,
    isSuccess: false,
    error: null,
    canResend: true,
    resendCooldown: 0,
  });

  const router = useRouter();
  const searchParams = useSearchParams();

  // Verify email mutation
  const verifyEmailMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Email verification failed');
      }

      return response.json();
    },
    onMutate: () => {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
      }));
    },
    onSuccess: () => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isSuccess: true,
      }));
      router.push('/auth/login?message=email_verified');
    },
    onError: (error: Error) => {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
    },
  });

  // Resend verification email mutation
  const resendVerificationMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to resend verification email');
      }

      return response.json();
    },
    onSuccess: () => {
      setState(prev => ({
        ...prev,
        canResend: false,
        resendCooldown: 30, // 30 seconds cooldown
      }));

      // Start cooldown timer
      const interval = setInterval(() => {
        setState(prev => {
          const newCooldown = prev.resendCooldown - 1;
          if (newCooldown <= 0) {
            clearInterval(interval);
            return {
              ...prev,
              resendCooldown: 0,
              canResend: true,
            };
          }
          return {
            ...prev,
            resendCooldown: newCooldown,
          };
        });
      }, 1000);
    },
  });

  // Auto-verify on mount if token is present
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      verifyEmailMutation.mutate(token);
    }
  }, [searchParams, verifyEmailMutation]);

  const verifyEmail = useCallback((token: string) => {
    verifyEmailMutation.mutate(token);
  }, [verifyEmailMutation]);

  const resendVerification = useCallback((email: string) => {
    if (state.canResend) {
      resendVerificationMutation.mutate(email);
    }
  }, [state.canResend, resendVerificationMutation]);

  return {
    ...state,
    verifyEmail,
    resendVerification,
    isResendLoading: resendVerificationMutation.isPending,
    resendError: resendVerificationMutation.error?.message || null,
  };
}

// Authentication flow state hook
export function useAuthFlow() {
  const [state, setState] = useState<AuthFlowState>({
    redirectTo: null,
    returnUrl: null,
    authenticationReason: null,
  });

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const redirectTo = searchParams.get('redirect');
    const returnUrl = searchParams.get('return');
    const reason = searchParams.get('reason');

    setState({
      redirectTo,
      returnUrl,
      authenticationReason: reason,
    });
  }, [searchParams]);

  const getRedirectUrl = useCallback((defaultPath = '/dashboard') => {
    return state.redirectTo || state.returnUrl || defaultPath;
  }, [state.redirectTo, state.returnUrl]);

  const getAuthMessage = useCallback(() => {
    switch (state.authenticationReason) {
      case 'session_expired':
        return 'Your session has expired. Please sign in again.';
      case 'unauthorized':
        return 'You need to sign in to access this page.';
      case 'role_required':
        return 'You need appropriate permissions to access this page.';
      case 'email_verified':
        return 'Your email has been verified successfully!';
      case 'password_reset_success':
        return 'Your password has been reset successfully. Please sign in with your new password.';
      default:
        return null;
    }
  }, [state.authenticationReason]);

  const navigateAfterAuth = useCallback((userRole?: string) => {
    const redirectUrl = getRedirectUrl();

    // Role-based default redirects
    if (redirectUrl === '/dashboard') {
      switch (userRole) {
        case 'barber':
          router.push('/barber-dashboard');
          break;
        case 'customer':
          router.push('/dashboard');
          break;
        case 'admin':
          router.push('/admin');
          break;
        default:
          router.push('/dashboard');
      }
    } else {
      router.push(redirectUrl);
    }
  }, [getRedirectUrl, router]);

  const createAuthUrl = useCallback((basePath: string, options: {
    redirect?: string;
    reason?: string;
  } = {}) => {
    const params = new URLSearchParams();

    if (options.redirect) {
      params.set('redirect', options.redirect);
    }

    if (options.reason) {
      params.set('reason', options.reason);
    }

    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }, []);

  return {
    ...state,
    getRedirectUrl,
    getAuthMessage,
    navigateAfterAuth,
    createAuthUrl,
  };
}

// Social authentication hook
export function useSocialAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const initiateOAuth = useCallback(async (provider: 'google' | 'facebook' | 'apple') => {
    setIsLoading(true);
    setError(null);

    try {
      // Get OAuth URL from backend
      const response = await fetch(`/api/auth/oauth/${provider}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }

      const { authUrl } = await response.json();

      // Redirect to OAuth provider
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth initiation failed');
      setIsLoading(false);
    }
  }, []);

  const handleOAuthCallback = useCallback(async (code: string, state: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'OAuth callback failed');
      }

      const { token, user } = await response.json();

      // Update auth store
      const authStore = useAuthStore.getState();
      authStore.login(user, token);

      // Navigate to appropriate page
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OAuth callback failed');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  return {
    isLoading,
    error,
    initiateOAuth,
    handleOAuthCallback,
  };
}