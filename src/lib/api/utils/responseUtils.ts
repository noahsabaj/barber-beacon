/**
 * API Response Utilities
 *
 * Convenient helper functions that integrate ApiResponse with ApiError
 * for consistent and easy-to-use response creation throughout the application.
 *
 * Features:
 * - Simplified response creation with type safety
 * - Automatic error handling and logging
 * - Consistent response formatting
 * - Business logic validation helpers
 * - Authentication and authorization helpers
 */

import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse } from '../base/ApiResponse'
import {
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  BusinessLogicError,
  RateLimitError,
  ErrorHandler
} from '../base/ApiError'

export interface ResponseOptions {
  message?: string
  requestId?: string
  headers?: Record<string, string>
}

export interface PaginationOptions {
  page: number
  limit: number
  total: number
  hasNext?: boolean
  hasPrev?: boolean
}

/**
 * Success Response Helpers
 */
export class ResponseHelpers {
  /**
   * Create a successful response with data
   */
  static success<T>(data: T, options?: ResponseOptions): NextResponse {
    const response = ApiResponse.success(data, options?.message)

    if (options?.requestId) {
      response.headers.set('X-Request-ID', options.requestId)
    }

    if (options?.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
    }

    return response
  }

  /**
   * Create a successful response with pagination
   */
  static paginated<T>(
    data: T[],
    pagination: PaginationOptions,
    options?: ResponseOptions
  ): NextResponse {
    const paginationMeta = {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.hasNext ?? (pagination.page * pagination.limit) < pagination.total,
      hasPrevious: pagination.hasPrev ?? pagination.page > 1,
      count: data.length
    }

    const response = ApiResponse.paginated(data, paginationMeta)

    if (options?.requestId) {
      response.headers.set('X-Request-ID', options.requestId)
    }

    return response
  }

  /**
   * Create a successful response for resource creation
   */
  static created<T>(data: T, location?: string, options?: ResponseOptions): NextResponse {
    const response = ResponseHelpers.success(data, {
      message: options?.message || 'Resource created successfully',
      ...options
    })

    response.headers.set('Status', '201')

    if (location) {
      response.headers.set('Location', location)
    }

    return NextResponse.json(
      data,
      { status: 201, headers: response.headers }
    )
  }

  /**
   * Create a successful response for updates
   */
  static updated<T>(data: T, options?: ResponseOptions): NextResponse {
    return ResponseHelpers.success(data, {
      message: options?.message || 'Resource updated successfully',
      ...options
    })
  }

  /**
   * Create a successful response for deletions
   */
  static deleted(options?: ResponseOptions): NextResponse {
    return ResponseHelpers.success(
      { deleted: true },
      {
        message: options?.message || 'Resource deleted successfully',
        ...options
      }
    )
  }

  /**
   * Create a no content response (204)
   */
  static noContent(options?: ResponseOptions): NextResponse {
    const response = new NextResponse(null, { status: 204 })

    if (options?.requestId) {
      response.headers.set('X-Request-ID', options.requestId)
    }

    return response
  }
}

/**
 * Error Response Helpers
 */
export class ErrorHelpers {
  /**
   * Create validation error response
   */
  static validation(
    message: string,
    field?: string,
    value?: any,
    options?: ResponseOptions
  ): NextResponse {
    const error = field
      ? ValidationError.fieldError(field, message, value)
      : new ValidationError(message)

    return ErrorHelpers.fromApiError(error, options)
  }

  /**
   * Create authentication error response
   */
  static authentication(message?: string, options?: ResponseOptions): NextResponse {
    const error = new AuthenticationError(message)
    return ErrorHelpers.fromApiError(error, options)
  }

  /**
   * Create authorization error response
   */
  static authorization(message?: string, options?: ResponseOptions): NextResponse {
    const error = new AuthorizationError(message)
    return ErrorHelpers.fromApiError(error, options)
  }

  /**
   * Create not found error response
   */
  static notFound(resource?: string, identifier?: string, options?: ResponseOptions): NextResponse {
    const error = resource
      ? NotFoundError.resource(resource, identifier)
      : new NotFoundError()

    return ErrorHelpers.fromApiError(error, options)
  }

  /**
   * Create conflict error response
   */
  static conflict(message: string, options?: ResponseOptions): NextResponse {
    const error = new ConflictError(message)
    return ErrorHelpers.fromApiError(error, options)
  }

  /**
   * Create business logic error response
   */
  static businessLogic(message: string, options?: ResponseOptions): NextResponse {
    const error = new BusinessLogicError(message)
    return ErrorHelpers.fromApiError(error, options)
  }

  /**
   * Create rate limit error response
   */
  static rateLimit(limit: number, window: string, retryAfter?: number, options?: ResponseOptions): NextResponse {
    const error = RateLimitError.exceeded(limit, window, retryAfter)
    const response = ErrorHelpers.fromApiError(error, options)

    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString())
    }

    return response
  }

  /**
   * Create error response from ApiError
   */
  static fromApiError(error: ApiError, options?: ResponseOptions): NextResponse {
    const response = ApiResponse.error(error.message, error.statusCode, error.code)

    if (options?.requestId) {
      response.headers.set('X-Request-ID', options.requestId)
    }

    // Add error details in development
    if (process.env.NODE_ENV === 'development') {
      const body = {
        error: error.message,
        code: error.code,
        details: error.details,
        metadata: error.metadata,
        timestamp: error.timestamp
      }

      return NextResponse.json(body, {
        status: error.statusCode,
        headers: response.headers
      })
    }

    return response
  }

  /**
   * Create error response from unknown error
   */
  static fromUnknown(error: unknown, options?: ResponseOptions): NextResponse {
    const apiError = ErrorHandler.toApiError(error)
    return ErrorHelpers.fromApiError(apiError, options)
  }
}

/**
 * Validation Helpers
 */
export class ValidationHelpers {
  /**
   * Validate required fields
   */
  static requireFields<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[],
    options?: ResponseOptions
  ): NextResponse | null {
    const missing = fields.filter(field =>
      data[field] === undefined || data[field] === null || data[field] === ''
    )

    if (missing.length > 0) {
      return ErrorHelpers.validation(
        `Missing required fields: ${missing.join(', ')}`,
        undefined,
        undefined,
        options
      )
    }

    return null
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string, options?: ResponseOptions): NextResponse | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(email)) {
      return ErrorHelpers.validation(
        'Invalid email format',
        'email',
        email,
        options
      )
    }

    return null
  }

  /**
   * Validate phone number format
   */
  static validatePhone(phone: string, options?: ResponseOptions): NextResponse | null {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/

    if (!phoneRegex.test(phone)) {
      return ErrorHelpers.validation(
        'Invalid phone number format',
        'phone',
        phone,
        options
      )
    }

    return null
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string, options?: ResponseOptions): NextResponse | null {
    if (password.length < 8) {
      return ErrorHelpers.validation(
        'Password must be at least 8 characters long',
        'password',
        undefined,
        options
      )
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return ErrorHelpers.validation(
        'Password must contain at least one letter and one number',
        'password',
        undefined,
        options
      )
    }

    return null
  }

  /**
   * Validate date range
   */
  static validateDateRange(
    startDate: Date,
    endDate: Date,
    options?: ResponseOptions
  ): NextResponse | null {
    if (startDate >= endDate) {
      return ErrorHelpers.validation(
        'Start date must be before end date',
        'dateRange',
        { startDate, endDate },
        options
      )
    }

    return null
  }

  /**
   * Validate future date
   */
  static validateFutureDate(date: Date, options?: ResponseOptions): NextResponse | null {
    if (date <= new Date()) {
      return ErrorHelpers.validation(
        'Date must be in the future',
        'date',
        date,
        options
      )
    }

    return null
  }
}

/**
 * Authentication Helpers
 */
export class AuthHelpers {
  /**
   * Extract and validate bearer token
   */
  static extractBearerToken(request: NextRequest): string | null {
    const authorization = request.headers.get('authorization')

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return null
    }

    return authorization.substring(7)
  }

  /**
   * Require authentication
   */
  static requireAuth(request: NextRequest, options?: ResponseOptions): NextResponse | null {
    const token = AuthHelpers.extractBearerToken(request)

    if (!token) {
      return ErrorHelpers.authentication('Authentication token required', options)
    }

    return null
  }

  /**
   * Require specific role
   */
  static requireRole(
    userRole: string,
    requiredRole: string,
    options?: ResponseOptions
  ): NextResponse | null {
    if (userRole !== requiredRole) {
      return ErrorHelpers.authorization(
        `Access requires ${requiredRole} role`,
        options
      )
    }

    return null
  }

  /**
   * Require resource ownership
   */
  static requireOwnership(
    userId: string,
    resourceUserId: string,
    options?: ResponseOptions
  ): NextResponse | null {
    if (userId !== resourceUserId) {
      return ErrorHelpers.authorization(
        'Access denied: insufficient permissions',
        options
      )
    }

    return null
  }
}

/**
 * Business Logic Helpers
 */
export class BusinessHelpers {
  /**
   * Check time slot availability
   */
  static validateTimeSlot(
    requestedTime: Date,
    existingBookings: Date[],
    options?: ResponseOptions
  ): NextResponse | null {
    const conflictingBooking = existingBookings.find(booking =>
      Math.abs(booking.getTime() - requestedTime.getTime()) < 15 * 60 * 1000 // 15 minutes
    )

    if (conflictingBooking) {
      return ErrorHelpers.businessLogic(
        'Time slot is not available',
        options
      )
    }

    return null
  }

  /**
   * Validate business hours
   */
  static validateBusinessHours(
    requestedTime: Date,
    openHour: number = 9,
    closeHour: number = 18,
    options?: ResponseOptions
  ): NextResponse | null {
    const hour = requestedTime.getHours()

    if (hour < openHour || hour >= closeHour) {
      return ErrorHelpers.businessLogic(
        `Appointments are only available between ${openHour}:00 and ${closeHour}:00`,
        options
      )
    }

    return null
  }

  /**
   * Validate minimum advance booking
   */
  static validateAdvanceBooking(
    requestedTime: Date,
    minimumHours: number = 24,
    options?: ResponseOptions
  ): NextResponse | null {
    const now = new Date()
    const minimumTime = new Date(now.getTime() + minimumHours * 60 * 60 * 1000)

    if (requestedTime < minimumTime) {
      return ErrorHelpers.businessLogic(
        `Appointments must be booked at least ${minimumHours} hours in advance`,
        options
      )
    }

    return null
  }
}

/**
 * Utility to wrap API handlers with consistent error handling and response formatting
 */
export function withApiHandler<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<T>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      const result = await handler(request, context)

      // If handler returns NextResponse, use it directly
      if (result instanceof NextResponse) {
        result.headers.set('X-Request-ID', requestId)
        return result
      }

      // Otherwise, wrap in success response
      return ResponseHelpers.success(result, { requestId })
    } catch (error) {
      return ErrorHelpers.fromUnknown(error, { requestId })
    }
  }
}