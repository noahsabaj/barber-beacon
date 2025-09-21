'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRegister } from '@/hooks/auth/useAuth';
import { useUIStore } from '@/stores/uiStore';
import { AuthErrorBoundary } from '@/components/ErrorBoundary/FeatureErrorBoundary';

// Password validation requirements
const passwordRequirements = [
  { id: 'length', label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { id: 'lowercase', label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number', test: (pw: string) => /\d/.test(pw) },
  { id: 'special', label: 'One special character', test: (pw: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phoneNumber: z.string().min(10, 'Please enter a valid phone number'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
  role: z.enum(['CUSTOMER', 'BARBER']),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
  marketingOptIn: z.boolean().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
  defaultRole?: 'CUSTOMER' | 'BARBER';
}

export function RegisterForm({
  onSuccess,
  defaultRole = 'CUSTOMER'
}: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const registerMutation = useRegister();
  const uiStore = useUIStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    watch,
    setValue,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema) as any,
    defaultValues: {
      role: defaultRole,
      acceptTerms: false,
      marketingOptIn: false,
    },
  });

  const watchedPassword = watch('password', '');
  const watchedRole = watch('role');

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerMutation.mutateAsync({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        password: data.password,
        role: data.role,
        marketingConsent: data.marketingOptIn,
        acceptedTerms: data.acceptTerms,
      });

      // Show success toast
      uiStore.addToast({
        type: 'success',
        title: 'Account Created!',
        message: 'Please check your email to verify your account.',
        duration: 7000,
      });

      // Call success callback
      onSuccess?.();

      // Redirect with verification notice
      router.push(`/auth/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (error: any) {
      // Handle specific error types
      if (error.message.includes('Email already exists')) {
        setError('email', {
          message: 'An account with this email already exists.',
        });
      } else if (error.message.includes('Phone number already exists')) {
        setError('phoneNumber', {
          message: 'An account with this phone number already exists.',
        });
      } else {
        setError('root', {
          message: error.message || 'Registration failed. Please try again.',
        });
      }

      // Show error toast
      uiStore.addToast({
        type: 'error',
        title: 'Registration Failed',
        message: error.message || 'Please check your information and try again.',
      });
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const checkPasswordRequirement = (requirement: typeof passwordRequirements[0]) => {
    return requirement.test(watchedPassword);
  };

  return (
    <AuthErrorBoundary>
      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
        {/* Role Selection */}
        <Tabs
          value={watchedRole}
          onValueChange={(value) => setValue('role', value as 'CUSTOMER' | 'BARBER')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="CUSTOMER">I'm looking for a barber</TabsTrigger>
            <TabsTrigger value="BARBER">I'm a barber</TabsTrigger>
          </TabsList>

          <TabsContent value="CUSTOMER" className="mt-4">
            <div className="text-sm text-muted-foreground">
              Create an account to book appointments, leave reviews, and manage your grooming schedule.
            </div>
          </TabsContent>

          <TabsContent value="BARBER" className="mt-4">
            <div className="text-sm text-muted-foreground">
              Join our platform to showcase your skills, manage bookings, and grow your business.
            </div>
          </TabsContent>
        </Tabs>

        {/* Personal Information */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              placeholder="Enter your first name"
              autoComplete="given-name"
              {...register('firstName')}
              className={errors.firstName ? 'border-destructive' : ''}
            />
            {errors.firstName && (
              <p className="text-sm text-destructive">{errors.firstName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              placeholder="Enter your last name"
              autoComplete="family-name"
              {...register('lastName')}
              className={errors.lastName ? 'border-destructive' : ''}
            />
            {errors.lastName && (
              <p className="text-sm text-destructive">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            {...register('email')}
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Phone Number Field */}
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <Input
            id="phoneNumber"
            type="tel"
            placeholder="(555) 123-4567"
            autoComplete="tel"
            {...register('phoneNumber')}
            className={errors.phoneNumber ? 'border-destructive' : ''}
          />
          {errors.phoneNumber && (
            <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              autoComplete="new-password"
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
            </Button>
          </div>

          {/* Password Requirements */}
          {watchedPassword && (
            <div className="space-y-1">
              {passwordRequirements.map((requirement) => {
                const isValid = checkPasswordRequirement(requirement);
                return (
                  <div
                    key={requirement.id}
                    className={`flex items-center gap-2 text-xs ${
                      isValid ? 'text-green-600' : 'text-muted-foreground'
                    }`}
                  >
                    {isValid ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    {requirement.label}
                  </div>
                );
              })}
            </div>
          )}

          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleConfirmPasswordVisibility}
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Terms and Conditions */}
        <div className="space-y-4">
          <div className="flex items-start space-x-2">
            <input
              id="acceptTerms"
              type="checkbox"
              className="mt-1 rounded border-gray-300 text-primary focus:ring-primary"
              {...register('acceptTerms')}
            />
            <Label htmlFor="acceptTerms" className="text-sm">
              I agree to the{' '}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto font-medium underline"
                onClick={() => window.open('/terms', '_blank')}
              >
                Terms of Service
              </Button>{' '}
              and{' '}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto font-medium underline"
                onClick={() => window.open('/privacy', '_blank')}
              >
                Privacy Policy
              </Button>
            </Label>
          </div>
          {errors.acceptTerms && (
            <p className="text-sm text-destructive">{errors.acceptTerms.message}</p>
          )}

          {/* Marketing Opt-in */}
          <div className="flex items-start space-x-2">
            <input
              id="marketingOptIn"
              type="checkbox"
              className="mt-1 rounded border-gray-300 text-primary focus:ring-primary"
              {...register('marketingOptIn')}
            />
            <Label htmlFor="marketingOptIn" className="text-sm font-normal">
              I would like to receive promotional emails and special offers
            </Label>
          </div>
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
          disabled={isSubmitting || registerMutation.isPending}
        >
          {isSubmitting || registerMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create Account'
          )}
        </Button>

        {/* Sign In Link */}
        <div className="text-center">
          <span className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Button
              type="button"
              variant="link"
              onClick={() => router.push('/auth/login')}
              className="p-0 h-auto font-medium"
            >
              Sign in here
            </Button>
          </span>
        </div>
      </form>
    </AuthErrorBoundary>
  );
}