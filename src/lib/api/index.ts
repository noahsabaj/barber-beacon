/**
 * API Layer Index
 *
 * Central export file for the entire API layer architecture.
 * Provides clean imports for all API-related utilities, errors, and response helpers.
 */

// Base API Infrastructure
export { ApiResponse } from './base/ApiResponse'
export {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessLogicError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  ErrorHandler,
  type ErrorDetail,
  type ApiErrorOptions
} from './base/ApiError'

// Error Handling Middleware
export {
  withErrorHandler,
  handleError,
  DomainErrorConverter,
  asyncErrorHandler,
  ErrorTypeGuards,
  type ErrorContext
} from './middleware/errorHandler'

// Response Utilities
export {
  ResponseHelpers,
  ErrorHelpers,
  ValidationHelpers,
  AuthHelpers,
  BusinessHelpers,
  withApiHandler,
  type ResponseOptions,
  type PaginationOptions
} from './utils/responseUtils'

// Validation Middleware
export {
  withValidation,
  CommonValidationSchemas,
  DomainValidationSchemas,
  ValidationUtils,
  ValidationMiddleware,
  type ValidationSchemas,
  type ValidationOptions,
  type ValidationContext,
  type ValidatedRequest
} from './middleware/validationMiddleware'

// Rate Limiting Middleware
export {
  withRateLimit,
  RateLimiter,
  InMemoryRateLimitStore,
  RedisRateLimitStore,
  RateLimitConfigs,
  RateLimitMiddleware,
  RateLimitAnalytics,
  type RateLimitConfig,
  type RateLimitInfo,
  type RateLimitStore,
  type RateLimitData,
  type RateLimitStrategy
} from './middleware/rateLimitMiddleware'

// Common Type Definitions
export interface ApiSuccessResponse<T> {
  success: true
  data: T
  message?: string
  timestamp: string
}

export interface ApiErrorResponse {
  success: false
  error: {
    message: string
    code: string
    details?: any[]
  }
  timestamp: string
}

export interface PaginatedResponse<T> extends ApiSuccessResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
    count: number
  }
}

// Utility Types for API Development
export type ApiHandler<T = any> = (
  request: Request,
  context?: any
) => Promise<T | Response>

export type ErrorHandlerFunction = (
  error: unknown,
  context: import('./middleware/errorHandler').ErrorContext
) => Response

export type ValidationResult = {
  isValid: boolean
  errors: import('./base/ApiError').ErrorDetail[]
}

// Status Code Constants
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const

// Common Error Codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE_ERROR: 'SERVICE_UNAVAILABLE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_MISSING: 'TOKEN_MISSING'
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]
export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS]