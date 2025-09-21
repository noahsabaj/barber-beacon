/**
 * Centralized API Error Classes and Error Handling
 *
 * Provides a comprehensive error handling system that integrates with ApiResponse
 * and follows RFC 7807 Problem Details for HTTP APIs standard.
 *
 * Features:
 * - Structured error information with HTTP status codes
 * - Type-safe error handling with specific error classes
 * - Integration with ApiResponse for consistent error responses
 * - Support for validation errors, business logic errors, and system errors
 * - Proper error serialization and logging support
 */

export interface ErrorDetail {
  field?: string
  message: string
  code?: string
  value?: any
}

export interface ApiErrorOptions {
  code?: string
  details?: ErrorDetail[]
  cause?: Error
  metadata?: Record<string, any>
  instance?: string
}

/**
 * Base API Error class that all API errors extend from
 */
export abstract class ApiError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details: ErrorDetail[]
  public readonly metadata: Record<string, any>
  public readonly instance?: string
  public readonly timestamp: string

  constructor(
    message: string,
    statusCode: number,
    options: ApiErrorOptions = {}
  ) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = options.code || this.constructor.name.toUpperCase()
    this.details = options.details || []
    this.metadata = options.metadata || {}
    if (options.instance !== undefined) {
      this.instance = options.instance
    }
    this.timestamp = new Date().toISOString()

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }

    // Chain the original error if provided
    if (options.cause) {
      this.cause = options.cause
    }
  }

  /**
   * Convert error to serializable object for API responses
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      metadata: this.metadata,
      instance: this.instance,
      timestamp: this.timestamp,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined
    }
  }

  /**
   * Convert error to RFC 7807 Problem Details format
   */
  toProblemDetails() {
    return {
      type: `https://barberbeacon.com/errors/${this.code.toLowerCase()}`,
      title: this.name,
      detail: this.message,
      status: this.statusCode,
      instance: this.instance,
      timestamp: this.timestamp,
      details: this.details,
      metadata: this.metadata
    }
  }
}

/**
 * Validation Error - 400 Bad Request
 * Used when request data fails validation rules
 */
export class ValidationError extends ApiError {
  constructor(message: string = 'Validation failed', options: ApiErrorOptions = {}) {
    super(message, 400, {
      code: 'VALIDATION_ERROR',
      ...options
    })
  }

  static fromZodError(zodError: any, message?: string) {
    const details: ErrorDetail[] = zodError.errors?.map((error: any) => ({
      field: error.path?.join('.'),
      message: error.message,
      code: error.code,
      value: error.received
    })) || []

    return new ValidationError(
      message || 'Request validation failed',
      { details }
    )
  }

  static fieldError(field: string, message: string, value?: any) {
    return new ValidationError(
      `Validation failed for field: ${field}`,
      {
        details: [{ field, message, value }]
      }
    )
  }
}

/**
 * Authentication Error - 401 Unauthorized
 * Used when authentication credentials are missing or invalid
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required', options: ApiErrorOptions = {}) {
    super(message, 401, {
      code: 'AUTHENTICATION_ERROR',
      ...options
    })
  }

  static invalidCredentials() {
    return new AuthenticationError('Invalid credentials provided')
  }

  static tokenExpired() {
    return new AuthenticationError('Authentication token has expired', {
      code: 'TOKEN_EXPIRED'
    })
  }

  static tokenInvalid() {
    return new AuthenticationError('Invalid authentication token', {
      code: 'TOKEN_INVALID'
    })
  }

  static tokenMissing() {
    return new AuthenticationError('Authentication token is required', {
      code: 'TOKEN_MISSING'
    })
  }
}

/**
 * Authorization Error - 403 Forbidden
 * Used when user is authenticated but lacks required permissions
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access denied', options: ApiErrorOptions = {}) {
    super(message, 403, {
      code: 'AUTHORIZATION_ERROR',
      ...options
    })
  }

  static insufficientPermissions(resource?: string) {
    return new AuthorizationError(
      resource ? `Insufficient permissions to access ${resource}` : 'Insufficient permissions',
      { metadata: { resource } }
    )
  }

  static roleRequired(requiredRole: string) {
    return new AuthorizationError(
      `Access requires ${requiredRole} role`,
      { metadata: { requiredRole } }
    )
  }
}

/**
 * Not Found Error - 404 Not Found
 * Used when requested resource doesn't exist
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found', options: ApiErrorOptions = {}) {
    super(message, 404, {
      code: 'NOT_FOUND_ERROR',
      ...options
    })
  }

  static resource(resourceType: string, identifier?: string) {
    const message = identifier
      ? `${resourceType} with identifier '${identifier}' not found`
      : `${resourceType} not found`

    return new NotFoundError(message, {
      metadata: { resourceType, identifier }
    })
  }
}

/**
 * Conflict Error - 409 Conflict
 * Used when request conflicts with current resource state
 */
export class ConflictError extends ApiError {
  constructor(message: string = 'Request conflicts with current state', options: ApiErrorOptions = {}) {
    super(message, 409, {
      code: 'CONFLICT_ERROR',
      ...options
    })
  }

  static duplicateResource(resourceType: string, field: string, value: string) {
    return new ConflictError(
      `${resourceType} with ${field} '${value}' already exists`,
      { metadata: { resourceType, field, value } }
    )
  }

  static operationConflict(operation: string, reason: string) {
    return new ConflictError(
      `Cannot ${operation}: ${reason}`,
      { metadata: { operation, reason } }
    )
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 * Used when client exceeds rate limiting thresholds
 */
export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded', options: ApiErrorOptions = {}) {
    super(message, 429, {
      code: 'RATE_LIMIT_ERROR',
      ...options
    })
  }

  static exceeded(limit: number, window: string, retryAfter?: number) {
    return new RateLimitError(
      `Rate limit of ${limit} requests per ${window} exceeded`,
      {
        metadata: { limit, window, retryAfter }
      }
    )
  }
}

/**
 * Business Logic Error - 422 Unprocessable Entity
 * Used when request is valid but violates business rules
 */
export class BusinessLogicError extends ApiError {
  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, 422, {
      code: 'BUSINESS_LOGIC_ERROR',
      ...options
    })
  }

  static ruleViolation(rule: string, reason: string) {
    return new BusinessLogicError(
      `Business rule violation: ${reason}`,
      { metadata: { rule, reason } }
    )
  }

  static invalidOperation(operation: string, reason: string) {
    return new BusinessLogicError(
      `Cannot perform ${operation}: ${reason}`,
      { metadata: { operation, reason } }
    )
  }

  static unavailableTimeSlot(date: string, time: string) {
    return new BusinessLogicError(
      `Time slot on ${date} at ${time} is not available`,
      { metadata: { date, time } }
    )
  }

  static bookingConflict(bookingId: string, reason: string) {
    return new BusinessLogicError(
      `Booking conflict: ${reason}`,
      { metadata: { bookingId, reason } }
    )
  }
}

/**
 * Internal Server Error - 500 Internal Server Error
 * Used for unexpected system errors
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', options: ApiErrorOptions = {}) {
    super(message, 500, {
      code: 'INTERNAL_SERVER_ERROR',
      ...options
    })
  }

  static databaseError(operation: string, cause?: Error) {
    return new InternalServerError(
      `Database operation failed: ${operation}`,
      {
        code: 'DATABASE_ERROR',
        metadata: { operation },
        ...(cause !== undefined && { cause })
      }
    )
  }

  static externalServiceError(service: string, cause?: Error) {
    return new InternalServerError(
      `External service error: ${service}`,
      {
        code: 'EXTERNAL_SERVICE_ERROR',
        metadata: { service },
        ...(cause !== undefined && { cause })
      }
    )
  }

  static configurationError(setting: string) {
    return new InternalServerError(
      `Configuration error: ${setting}`,
      {
        code: 'CONFIGURATION_ERROR',
        metadata: { setting }
      }
    )
  }
}

/**
 * Service Unavailable Error - 503 Service Unavailable
 * Used when service is temporarily unavailable
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service temporarily unavailable', options: ApiErrorOptions = {}) {
    super(message, 503, {
      code: 'SERVICE_UNAVAILABLE_ERROR',
      ...options
    })
  }

  static maintenance(estimatedDuration?: string) {
    return new ServiceUnavailableError(
      'Service is under maintenance',
      {
        code: 'MAINTENANCE_MODE',
        metadata: { estimatedDuration }
      }
    )
  }

  static overloaded(retryAfter?: number) {
    return new ServiceUnavailableError(
      'Service is temporarily overloaded',
      {
        code: 'SERVICE_OVERLOADED',
        metadata: { retryAfter }
      }
    )
  }
}

/**
 * Error Handler Utility Class
 */
export class ErrorHandler {
  /**
   * Convert unknown error to ApiError
   */
  static toApiError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error
    }

    if (error instanceof Error) {
      return new InternalServerError(
        'An unexpected error occurred',
        { cause: error }
      )
    }

    return new InternalServerError(
      'An unknown error occurred',
      { metadata: { originalError: String(error) } }
    )
  }

  /**
   * Check if error is a specific type of ApiError
   */
  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError
  }

  static isValidationError(error: unknown): error is ValidationError {
    return error instanceof ValidationError
  }

  static isAuthenticationError(error: unknown): error is AuthenticationError {
    return error instanceof AuthenticationError
  }

  static isAuthorizationError(error: unknown): error is AuthorizationError {
    return error instanceof AuthorizationError
  }

  static isNotFoundError(error: unknown): error is NotFoundError {
    return error instanceof NotFoundError
  }

  static isConflictError(error: unknown): error is ConflictError {
    return error instanceof ConflictError
  }

  static isBusinessLogicError(error: unknown): error is BusinessLogicError {
    return error instanceof BusinessLogicError
  }

  static isInternalServerError(error: unknown): error is InternalServerError {
    return error instanceof InternalServerError
  }

  /**
   * Log error with appropriate level based on status code
   */
  static logError(error: ApiError, requestId?: string) {
    const logData = {
      ...error.toJSON(),
      requestId,
      userAgent: undefined, // Will be filled by actual logger
      ip: undefined // Will be filled by actual logger
    }

    // Log level based on status code
    if (error.statusCode >= 500) {
      console.error('Server Error:', logData)
    } else if (error.statusCode >= 400) {
      console.warn('Client Error:', logData)
    } else {
      console.info('API Error:', logData)
    }
  }
}