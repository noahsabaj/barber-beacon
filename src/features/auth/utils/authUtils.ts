import { PublicUserProfile as User } from '@/lib/api/types/api-dtos';

/**
 * Get user's display name
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return 'Guest';

  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }

  if (user.firstName) {
    return user.firstName;
  }

  return user.email.split('@')[0] || 'User';
}

/**
 * Get user's initials for avatar
 */
export function getUserInitials(user: User | null): string {
  if (!user) return 'G';

  if (user.firstName && user.lastName) {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }

  if (user.firstName) {
    return user.firstName.charAt(0).toUpperCase();
  }

  return user.email.charAt(0).toUpperCase();
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;

  // Admin has all permissions
  if (user.role === 'ADMIN') return true;

  // Define role-based permissions
  const rolePermissions: Record<string, string[]> = {
    CUSTOMER: [
      'bookings.create',
      'bookings.view.own',
      'bookings.update.own',
      'bookings.cancel.own',
      'reviews.create',
      'reviews.view.own',
      'reviews.update.own',
      'profile.view.own',
      'profile.update.own',
    ],
    BARBER: [
      'bookings.view.own',
      'bookings.update.own',
      'bookings.complete',
      'reviews.view.own',
      'reviews.respond',
      'profile.view.own',
      'profile.update.own',
      'services.create',
      'services.update.own',
      'services.delete.own',
      'analytics.view.own',
    ],
    ADMIN: [], // Admins have all permissions by default
  };

  const userPermissions = rolePermissions[user.role] || [];
  return userPermissions.includes(permission);
}

/**
 * Check if user can access specific resource
 */
export function canAccessResource(
  user: User | null,
  resource: { userId?: string; barberId?: string; isPublic?: boolean }
): boolean {
  if (!user) return resource.isPublic || false;

  // Admin can access everything
  if (user.role === 'ADMIN') return true;

  // User can access their own resources
  if (resource.userId === user.id) return true;

  // Barber can access their own barber resources
  if (user.role === 'BARBER' && resource.barberId) {
    // This would need to check if user owns the barber profile
    // For now, we'll assume barberId matches userId for barbers
    return resource.barberId === user.id;
  }

  // Fall back to public access
  return resource.isPublic || false;
}

/**
 * Get redirect URL based on user role
 */
export function getDefaultRedirectUrl(user: User | null): string {
  if (!user) return '/';

  switch (user.role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'BARBER':
      return '/barber-dashboard';
    case 'CUSTOMER':
    default:
      return '/dashboard';
  }
}

/**
 * Check if user profile is complete
 */
export function isProfileComplete(user: User | null): boolean {
  if (!user) return false;

  const requiredFields = ['firstName', 'lastName', 'email'];

  for (const field of requiredFields) {
    if (!user[field as keyof User]) {
      return false;
    }
  }

  // Role-specific requirements
  if (user.role === 'BARBER') {
    // Barbers need additional profile information
    // This would check for barber profile completion
    return true; // Simplified for now
  }

  return true;
}

/**
 * Generate user avatar URL or return initials
 */
export function getUserAvatar(user: User | null): { type: 'image' | 'initials'; value: string } {
  if (!user) {
    return { type: 'initials', value: 'G' };
  }

  // Always use initials for now (profileImage not in PublicUserProfile)
  return { type: 'initials', value: getUserInitials(user) };
}

/**
 * Format user role for display
 */
export function formatUserRole(role: string): string {
  switch (role) {
    case 'CUSTOMER':
      return 'Customer';
    case 'BARBER':
      return 'Barber';
    case 'ADMIN':
      return 'Administrator';
    default:
      return role;
  }
}

/**
 * Check if password meets requirements
 */
export function validatePassword(password: string): {
  isValid: boolean;
  requirements: Array<{ id: string; label: string; met: boolean }>;
} {
  const requirements = [
    { id: 'length', label: 'At least 8 characters', met: password.length >= 8 },
    { id: 'uppercase', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { id: 'number', label: 'One number', met: /\d/.test(password) },
    { id: 'special', label: 'One special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  const isValid = requirements.every(req => req.met);

  return { isValid, requirements };
}

/**
 * Generate a secure password
 */
export function generatePassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*(),.?":{}|<>';

  let password = '';

  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  const allChars = lowercase + uppercase + numbers + special;
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Check if email is valid
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Format as (XXX) XXX-XXXX for US numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Return original if not a standard format
  return phone;
}

/**
 * Parse JWT token payload (client-side only, for display purposes)
 */
export function parseJWTPayload(token: string): any {
  try {
    const parts = token.split('.');
    const payload = parts[1];
    if (!payload) {
      throw new Error('Invalid token format');
    }
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to parse JWT token:', error);
    return null;
  }
}

/**
 * Check if JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = parseJWTPayload(token);
    if (!payload || !payload.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    return true;
  }
}