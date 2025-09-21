'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLogin } from '@/hooks/auth/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { AuthErrorBoundary } from '@/components/ErrorBoundary/FeatureErrorBoundary';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
}

export function LoginForm({ onSuccess, redirectTo = '/dashboard' }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const loginMutation = useLogin();
  const { isLoginBlocked } = useAuthStore();
  const uiStore = useUIStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema) as any,
    defaultValues: {
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      // Check if login is blocked
      if (isLoginBlocked()) {
        setError('root', {
          message: 'Too many failed login attempts. Please try again in 15 minutes.',
        });
        return;
      }

      // Attempt login
      await loginMutation.mutateAsync({
        email: data.email,
        password: data.password,
      });

      // Show success toast
      uiStore.addToast({
        type: 'success',
        title: 'Welcome back!',
        message: 'You have been successfully logged in.',
      });

      // Call success callback
      onSuccess?.();

      // Redirect to appropriate page
      router.push(redirectTo);
    } catch (error: any) {
      // Handle specific error types
      if (error.message.includes('Invalid credentials')) {
        setError('root', {
          message: 'Invalid email or password. Please try again.',
        });
      } else if (error.message.includes('Account not verified')) {
        setError('root', {
          message: 'Please verify your email address before logging in.',
        });
      } else if (error.message.includes('Account locked')) {
        setError('root', {
          message: 'Your account has been temporarily locked. Please contact support.',
        });
      } else {
        setError('root', {
          message: error.message || 'Login failed. Please try again.',
        });
      }

      // Show error toast
      uiStore.addToast({
        type: 'error',
        title: 'Login Failed',
        message: error.message || 'Please check your credentials and try again.',
      });
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <AuthErrorBoundary>
      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            {...register('email')}
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => router.push('/auth/forgot-password')}
              className="h-auto p-0 text-sm"
            >
              Forgot password?
            </Button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              {...register('password')}
              className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={togglePasswordVisibility}
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <span className="sr-only">
                {showPassword ? 'Hide password' : 'Show password'}
              </span>
            </Button>
          </div>
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Remember Me */}
        <div className="flex items-center space-x-2">
          <input
            id="rememberMe"
            type="checkbox"
            className="rounded border-gray-300 text-primary focus:ring-primary"
            {...register('rememberMe')}
          />
          <Label htmlFor="rememberMe" className="text-sm font-normal">
            Remember me for 7 days
          </Label>
        </div>

        {/* Error Alert */}
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || loginMutation.isPending || isLoginBlocked()}
        >
          {isSubmitting || loginMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </Button>

        {/* Sign Up Link */}
        <div className="text-center">
          <span className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Button
              type="button"
              variant="link"
              onClick={() => router.push('/auth/register')}
              className="p-0 h-auto font-medium"
            >
              Sign up here
            </Button>
          </span>
        </div>
      </form>
    </AuthErrorBoundary>
  );
}