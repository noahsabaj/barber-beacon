/**
 * Authentication API Validation Schemas
 *
 * Comprehensive Zod schemas for all authentication-related endpoints.
 * Designed to work with the validation middleware and provide type safety.
 *
 * Features:
 * - Request/response validation for all auth endpoints
 * - Password strength validation with business rules
 * - Email format validation
 * - Role-based validation
 * - Phone number and address validation
 * - Custom error messages
 * - Transformation and sanitization
 */

import { z } from 'zod'
import { VALIDATION_RULES } from '@/lib/validation-constants'

// ===== COMMON VALIDATION SCHEMAS =====

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .transform(email => email.toLowerCase().trim())

export const passwordSchema = z
  .string()
  .min(VALIDATION_RULES.PASSWORD.MIN_LENGTH, VALIDATION_RULES.PASSWORD.ERROR_MESSAGE)
  .regex(VALIDATION_RULES.PASSWORD.REGEX, VALIDATION_RULES.PASSWORD.ERROR_MESSAGE)

export const strongPasswordSchema = passwordSchema
  .min(12, 'Strong password must be at least 12 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Strong password must contain uppercase, lowercase, number, and special character'
  )

export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-\(\)]{10,}$/, 'Invalid phone number format')
  .transform(phone => phone.replace(/[\s\-\(\)]/g, ''))
  .optional()

export const roleSchema = z.enum(['customer', 'barber', 'admin']).default('customer')

export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name must be less than 50 characters')
  .regex(/^[a-zA-Z\s\-']+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .transform(name => name.trim())

export const addressSchema = z
  .string()
  .max(200, 'Address must be less than 200 characters')
  .optional()

// ===== REGISTRATION SCHEMAS =====

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  address: addressSchema,
  role: roleSchema
})

export const registerResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: roleSchema,
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().optional(),
    address: z.string().optional(),
    createdAt: z.string().datetime()
  }),
  token: z.string().min(1, 'Token is required')
})

// ===== LOGIN SCHEMAS =====

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false)
})

export const loginResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: roleSchema,
    firstName: z.string(),
    lastName: z.string(),
    phone: z.string().optional(),
    address: z.string().optional(),
    barberProfile: z.object({
      id: z.string().uuid(),
      businessName: z.string().optional(),
      description: z.string().optional(),
      address: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      phone: z.string().optional(),
      website: z.string().url().optional(),
      averageRating: z.number().min(0).max(5).optional(),
      totalReviews: z.number().min(0).optional(),
      isActive: z.boolean()
    }).optional()
  }),
  token: z.string().min(1, 'Token is required')
})

// ===== PASSWORD RESET SCHEMAS =====

export const requestPasswordResetSchema = z.object({
  email: emailSchema
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, 'Password confirmation is required')
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword']
})

// ===== PROFILE UPDATE SCHEMAS =====

export const updateProfileSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema,
  address: addressSchema,
  avatar: z.string().url('Invalid avatar URL').optional(),
  preferences: z.object({
    notifications: z.object({
      email: z.boolean().default(true),
      sms: z.boolean().default(true),
      push: z.boolean().default(true)
    }).optional(),
    privacy: z.object({
      showPhone: z.boolean().default(false),
      showEmail: z.boolean().default(false),
      showAddress: z.boolean().default(false)
    }).optional(),
    language: z.enum(['en', 'es', 'fr']).default('en').optional(),
    timezone: z.string().optional()
  }).optional()
})

export const updateProfileResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: roleSchema,
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
  avatar: z.string().url().optional(),
  preferences: z.object({
    notifications: z.object({
      email: z.boolean(),
      sms: z.boolean(),
      push: z.boolean()
    }),
    privacy: z.object({
      showPhone: z.boolean(),
      showEmail: z.boolean(),
      showAddress: z.boolean()
    }),
    language: z.string(),
    timezone: z.string().optional()
  }).optional(),
  updatedAt: z.string().datetime()
})

// ===== EMAIL VERIFICATION SCHEMAS =====

export const sendVerificationEmailSchema = z.object({
  email: emailSchema
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
  email: emailSchema.optional()
})

// ===== TWO-FACTOR AUTHENTICATION SCHEMAS =====

export const enable2FASchema = z.object({
  password: z.string().min(1, 'Password is required')
})

export const verify2FASchema = z.object({
  token: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d{6}$/, 'Verification code must be numeric'),
  backupCode: z.string().optional()
}).refine(data => data.token || data.backupCode, {
  message: 'Either verification code or backup code is required'
})

export const disable2FASchema = z.object({
  password: z.string().min(1, 'Password is required'),
  token: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d{6}$/, 'Verification code must be numeric')
})

// ===== SESSION MANAGEMENT SCHEMAS =====

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
})

export const revokeSessionSchema = z.object({
  sessionId: z.string().uuid().optional(),
  all: z.boolean().default(false)
})

export const sessionResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  device: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
  ip: z.string(),
  location: z.string().optional(),
  isActive: z.boolean(),
  lastActivity: z.string().datetime(),
  createdAt: z.string().datetime()
})

// ===== USER QUERY SCHEMAS =====

export const getCurrentUserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: roleSchema,
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
  avatar: z.string().url().optional(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  preferences: z.object({
    notifications: z.object({
      email: z.boolean(),
      sms: z.boolean(),
      push: z.boolean()
    }),
    privacy: z.object({
      showPhone: z.boolean(),
      showEmail: z.boolean(),
      showAddress: z.boolean()
    }),
    language: z.string(),
    timezone: z.string().optional()
  }).optional(),
  barberProfile: z.object({
    id: z.string().uuid(),
    businessName: z.string().optional(),
    description: z.string().optional(),
    address: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    phone: z.string().optional(),
    website: z.string().url().optional(),
    averageRating: z.number().min(0).max(5).optional(),
    totalReviews: z.number().min(0).optional(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

// ===== ADMIN SCHEMAS =====

export const adminUpdateUserSchema = z.object({
  email: emailSchema.optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  twoFactorEnabled: z.boolean().optional()
})

export const adminUserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  emailVerified: z.boolean().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'email', 'firstName', 'lastName']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
})

// ===== RATE LIMITING BYPASS SCHEMAS =====

export const rateLimitBypassSchema = z.object({
  adminToken: z.string().min(1, 'Admin token is required'),
  reason: z.string().min(1, 'Bypass reason is required'),
  duration: z.number().int().min(1).max(3600).default(300) // Max 1 hour, default 5 minutes
})

// ===== OAUTH SCHEMAS =====

export const oauthCallbackSchema = z.object({
  provider: z.enum(['google', 'facebook', 'apple']),
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().optional(),
  redirectUri: z.string().url('Invalid redirect URI').optional()
})

export const oauthLinkSchema = z.object({
  provider: z.enum(['google', 'facebook', 'apple']),
  accessToken: z.string().min(1, 'Access token is required')
})

// ===== AUDIT LOG SCHEMAS =====

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.enum([
    'login',
    'logout',
    'register',
    'password_change',
    'password_reset',
    'email_verification',
    '2fa_enable',
    '2fa_disable',
    'profile_update',
    'account_deletion'
  ]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  ip: z.string().regex(/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/, 'Invalid IP address').optional(),
  userAgent: z.string().optional()
})

export const auditLogResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  ip: z.string(),
  userAgent: z.string().optional(),
  createdAt: z.string().datetime()
})

// ===== ACCOUNT DELETION SCHEMAS =====

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  reason: z.enum([
    'no_longer_needed',
    'privacy_concerns',
    'found_alternative',
    'dissatisfied',
    'other'
  ]).optional(),
  feedback: z.string().max(500, 'Feedback must be less than 500 characters').optional(),
  deleteData: z.boolean().default(true),
  confirmDeletion: z.literal(true).refine(val => val === true, {
    message: 'Account deletion must be confirmed'
  })
})

// ===== VALIDATION SCHEMA COLLECTIONS =====

export const AuthValidationSchemas = {
  // Registration
  register: {
    body: registerRequestSchema,
    response: registerResponseSchema
  },

  // Login
  login: {
    body: loginRequestSchema,
    response: loginResponseSchema
  },

  // Current user
  me: {
    response: getCurrentUserResponseSchema
  },

  // Password management
  requestPasswordReset: {
    body: requestPasswordResetSchema
  },

  resetPassword: {
    body: resetPasswordSchema
  },

  changePassword: {
    body: changePasswordSchema
  },

  // Profile management
  updateProfile: {
    body: updateProfileSchema,
    response: updateProfileResponseSchema
  },

  // Email verification
  sendVerificationEmail: {
    body: sendVerificationEmailSchema
  },

  verifyEmail: {
    body: verifyEmailSchema
  },

  // Two-factor authentication
  enable2FA: {
    body: enable2FASchema
  },

  verify2FA: {
    body: verify2FASchema
  },

  disable2FA: {
    body: disable2FASchema
  },

  // Session management
  refreshToken: {
    body: refreshTokenSchema
  },

  revokeSession: {
    body: revokeSessionSchema
  },

  getSessions: {
    response: z.array(sessionResponseSchema)
  },

  // OAuth
  oauthCallback: {
    body: oauthCallbackSchema
  },

  oauthLink: {
    body: oauthLinkSchema
  },

  // Admin operations
  adminUpdateUser: {
    body: adminUpdateUserSchema
  },

  adminUserQuery: {
    query: adminUserQuerySchema
  },

  // Audit logs
  auditLogQuery: {
    query: auditLogQuerySchema
  },

  auditLog: {
    response: z.array(auditLogResponseSchema)
  },

  // Account deletion
  deleteAccount: {
    body: deleteAccountSchema
  },

  // Rate limiting
  rateLimitBypass: {
    body: rateLimitBypassSchema
  }
}

// ===== TYPE EXPORTS =====

export type RegisterRequest = z.infer<typeof registerRequestSchema>
export type RegisterResponse = z.infer<typeof registerResponseSchema>
export type LoginRequest = z.infer<typeof loginRequestSchema>
export type LoginResponse = z.infer<typeof loginResponseSchema>
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>
export type UpdateProfileResponse = z.infer<typeof updateProfileResponseSchema>
export type GetCurrentUserResponse = z.infer<typeof getCurrentUserResponseSchema>
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>
export type Enable2FARequest = z.infer<typeof enable2FASchema>
export type Verify2FARequest = z.infer<typeof verify2FASchema>
export type AdminUpdateUserRequest = z.infer<typeof adminUpdateUserSchema>
export type AdminUserQuery = z.infer<typeof adminUserQuerySchema>
export type DeleteAccountRequest = z.infer<typeof deleteAccountSchema>
export type OAuthCallbackRequest = z.infer<typeof oauthCallbackSchema>
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>
export type SessionResponse = z.infer<typeof sessionResponseSchema>

// ===== CUSTOM VALIDATION HELPERS =====

export const AuthValidationHelpers = {
  /**
   * Validate password strength based on user role
   */
  getPasswordSchema(role: 'customer' | 'barber' | 'admin') {
    return role === 'admin' ? strongPasswordSchema : passwordSchema
  },

  /**
   * Validate email uniqueness (to be used in API routes)
   */
  emailExists: z.string().email().refine(async (_email) => {
    // This would be implemented in the API route
    // return !(await checkEmailExists(email))
    return true
  }, 'Email already exists'),

  /**
   * Custom phone validation by country
   */
  getPhoneSchema(country?: string) {
    const patterns = {
      US: /^\+?1?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}$/,
      UK: /^\+?44[\s\-]?\d{4}[\s\-]?\d{6}$/,
      CA: /^\+?1?[\s\-]?\(?[0-9]{3}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}$/
    }

    if (country && patterns[country as keyof typeof patterns]) {
      return z.string().regex(patterns[country as keyof typeof patterns], `Invalid ${country} phone number format`)
    }

    return phoneSchema
  },

  /**
   * Conditional validation for barber-specific fields
   */
  conditionalBarberFields: z.object({
    role: roleSchema,
    businessName: z.string().min(1).optional(),
    businessAddress: z.string().min(1).optional(),
    businessPhone: phoneSchema
  }).refine((data) => {
    if (data.role === 'barber') {
      return data.businessName && data.businessAddress
    }
    return true
  }, {
    message: 'Business name and address are required for barber accounts',
    path: ['businessName']
  })
}