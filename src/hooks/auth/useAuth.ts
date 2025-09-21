import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LoginRequestDTO,
  RegisterRequestDTO,
  LoginResponseDTO,
  RegisterResponseDTO,
  PublicUserProfile as User
} from '@/lib/api/types/api-dtos';


// Query keys for consistent cache management
export const authKeys = {
  all: ['auth'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  profile: () => [...authKeys.all, 'profile'] as const,
} as const;

/**
 * Hook for user authentication state
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: async (): Promise<User | null> => {
      const token = localStorage.getItem('token');
      if (!token) return null;

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          localStorage.removeItem('token');
          return null;
        }

        const data = await response.json();
        return data.data;
      } catch (error) {
        localStorage.removeItem('token');
        return null;
      }
    },
    staleTime: 15 * 60 * 1000, // Consider user data stale after 15 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: false, // Don't retry auth failures
  });
}

/**
 * Hook for user login
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginRequestDTO): Promise<LoginResponseDTO> => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Store token in localStorage
      localStorage.setItem('token', data.accessToken);

      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: authKeys.user() });

      // Set user data in cache immediately for better UX
      queryClient.setQueryData(authKeys.user(), data.user);
    },
    onError: () => {
      // Clear any existing auth data on login failure
      localStorage.removeItem('token');
      queryClient.clear();
    },
  });
}

/**
 * Hook for user registration
 */
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userData: RegisterRequestDTO): Promise<RegisterResponseDTO> => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registration failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Store token in localStorage
      localStorage.setItem('token', data.accessToken);

      // Set user data in cache
      queryClient.setQueryData(authKeys.user(), data.user);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: authKeys.user() });
    },
  });
}

/**
 * Hook for user logout
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      // Call logout endpoint if it exists
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
        } catch (error) {
          // Ignore logout endpoint errors - still clear local state
          console.warn('Logout endpoint error:', error);
        }
      }
    },
    onSuccess: () => {
      // Clear token from localStorage
      localStorage.removeItem('token');

      // Clear all cached data
      queryClient.clear();
    },
    onError: () => {
      // Even if logout fails, clear local state
      localStorage.removeItem('token');
      queryClient.clear();
    },
  });
}

/**
 * Hook for password reset request
 */
export function usePasswordReset() {
  return useMutation({
    mutationFn: async (email: string): Promise<{ message: string }> => {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Password reset failed');
      }

      return response.json();
    },
  });
}

/**
 * Hook for updating user profile
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<User>): Promise<User> => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Profile update failed');
      }

      const data = await response.json();
      return data.data;
    },
    onSuccess: (updatedUser) => {
      // Update user data in cache
      queryClient.setQueryData(authKeys.user(), updatedUser);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: authKeys.profile() });
    },
  });
}