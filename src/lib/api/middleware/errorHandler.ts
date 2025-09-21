/**
 * Centralized Error Handling Middleware
 *
 * Provides a standardized way to handle errors across all API routes.
 * Integrates with ApiResponse and ApiError classes for consistent error responses.
 *
 * Features:
 * - Automatic error type detection and appropriate response generation
 * - Request ID tracking for debugging
 * - Structured error logging
 * - Rate limiting error handling
 * - Prisma error conversion
 * - Zod validation error conversion
 * - Development vs production error information
 */

import { NextRequest, NextResponse } from 'next/server'
import { ApiResponse } from '../base/ApiResponse'
import {
  ApiError,
  ErrorHandler,
  ValidationError,
  AuthenticationError,
  BusinessLogicError,
  InternalServerError,
  ConflictError,
  NotFoundError
} from '../base/ApiError'

export interface ErrorContext {
  request: NextRequest
  requestId: string
  userId?: string
  userAgent?: string
  ip?: string
  route?: string
  method?: string
}

/**
 * Global Error Handler Middleware
 *
 * Wraps API route handlers to provide consistent error handling
 */
export function withErrorHandler<T = any>(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse<T>>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const requestId = generateRequestId()
    const userAgent = request.headers.get('user-agent');
    const errorContext: ErrorContext = {
      request,
      requestId,
      ...(userAgent !== null && { userAgent }),
      ip: getClientIP(request),
      route: request.nextUrl.pathname,
      method: request.method
    }

    try {
      // Add request ID to headers for tracking
      const response = await handler(request, context)
      response.headers.set('X-Request-ID', requestId)
      return response
    } catch (error) {
      return handleError(error, errorContext)
    }
  }
}

/**
 * Main error handling function
 */
export function handleError(error: unknown, context: ErrorContext): NextResponse {
  let apiError: ApiError

  // Convert various error types to ApiError
  if (ErrorHandler.isApiError(error)) {
    apiError = error
  } else if (isPrismaError(error)) {
    apiError = convertPrismaError(error)
  } else if (isZodError(error)) {
    apiError = ValidationError.fromZodError(error)
  } else if (error instanceof Error) {
    apiError = new InternalServerError(
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'An unexpected error occurred',
      { cause: error }
    )
  } else {
    apiError = new InternalServerError('An unknown error occurred')
  }

  // Log the error
  logError(apiError, context)

  // Create error response
  const response = ApiResponse.error(
    apiError.message,
    apiError.statusCode,
    apiError.code
  )

  // Add error details in development mode
  if (process.env.NODE_ENV === 'development') {
    const errorBody = {
      success: false,
      message: apiError.message,
      code: apiError.code,
      details: apiError.details,
      metadata: apiError.metadata,
      stack: apiError.stack,
      requestId: context.requestId
    }

    return NextResponse.json(errorBody, {
      status: apiError.statusCode,
      headers: {
        'X-Request-ID': context.requestId,
        'Content-Type': 'application/json'
      }
    })
  }

  // Production response - minimal error information
  response.headers.set('X-Request-ID', context.requestId)
  return response
}

/**
 * Prisma Error Detection and Conversion
 */
function isPrismaError(error: any): boolean {
  return error?.code && typeof error.code === 'string' && error.code.startsWith('P')
}

function convertPrismaError(error: any): ApiError {
  const code = error.code
  const meta = error.meta || {}

  switch (code) {
    case 'P2000':
      return new ValidationError('Value too long for field', {
        details: [{
          field: meta.column_name,
          message: 'Value exceeds maximum length',
          code: 'VALUE_TOO_LONG'
        }]
      })

    case 'P2001':
      return new NotFoundError('Record not found in database', {
        metadata: { table: meta.table, cause: meta.cause }
      })

    case 'P2002':
      return new ConflictError('Unique constraint violation', {
        details: meta.target?.map((field: string) => ({
          field,
          message: `Value already exists for ${field}`,
          code: 'UNIQUE_VIOLATION'
        })) || []
      })

    case 'P2003':
      return new ValidationError('Foreign key constraint failed', {
        details: [{
          field: meta.field_name,
          message: 'Referenced record does not exist',
          code: 'FOREIGN_KEY_VIOLATION'
        }]
      })

    case 'P2004':
      return new ValidationError('Database constraint violation', {
        details: [{
          message: meta.constraint || 'Database constraint violated',
          code: 'CONSTRAINT_VIOLATION'
        }]
      })

    case 'P2025':
      return new NotFoundError('Required record not found', {
        metadata: { operation: meta.cause }
      })

    case 'P1008':
      return new InternalServerError('Database operation timeout', {
        code: 'DATABASE_TIMEOUT'
      })

    case 'P1017':
      return new InternalServerError('Database connection lost', {
        code: 'DATABASE_CONNECTION_LOST'
      })

    default:
      return new InternalServerError('Database operation failed', {
        code: 'DATABASE_ERROR',
        metadata: { prismaCode: code, prismaMessage: error.message }
      })
  }
}

/**
 * Zod Error Detection and Conversion
 */
function isZodError(error: any): boolean {
  return error?.name === 'ZodError' || error?.issues || error?.errors
}

/**
 * Request ID Generation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get Client IP Address
 */
function getClientIP(request: NextRequest): string {
  // Check various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cloudflareIP = request.headers.get('cf-connecting-ip')

  if (cloudflareIP) return cloudflareIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'

  return 'unknown'
}

/**
 * Structured Error Logging
 */
function logError(error: ApiError, context: ErrorContext): void {
  const logData = {
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
    error: {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    },
    request: {
      method: context.method,
      url: context.route,
      userAgent: context.userAgent,
      ip: context.ip
    },
    user: {
      id: context.userId
    }
  }

  // Log based on severity
  if (error.statusCode >= 500) {
    console.error('🚨 Server Error:', JSON.stringify(logData, null, 2))
  } else if (error.statusCode >= 400) {
    console.warn('⚠️  Client Error:', JSON.stringify(logData, null, 2))
  } else {
    console.info('ℹ️  API Error:', JSON.stringify(logData, null, 2))
  }

  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production' && error.statusCode >= 500) {
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
    // errorTracking.captureError(error, logData)
  }
}

/**
 * Domain-Specific Error Converters
 */
export class DomainErrorConverter {
  /**
   * Convert booking-related errors
   */
  static convertBookingError(error: unknown): ApiError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('time slot') && message.includes('unavailable')) {
        return new BusinessLogicError('Selected time slot is not available')
      }

      if (message.includes('double booking') || message.includes('conflict')) {
        return new ConflictError('Booking conflict detected')
      }

      if (message.includes('past date') || message.includes('invalid date')) {
        return new ValidationError('Cannot book appointments in the past')
      }
    }

    return ErrorHandler.toApiError(error)
  }

  /**
   * Convert authentication-related errors
   */
  static convertAuthError(error: unknown): ApiError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('invalid credentials') || message.includes('wrong password')) {
        return AuthenticationError.invalidCredentials()
      }

      if (message.includes('token expired')) {
        return AuthenticationError.tokenExpired()
      }

      if (message.includes('token invalid') || message.includes('malformed')) {
        return AuthenticationError.tokenInvalid()
      }
    }

    return ErrorHandler.toApiError(error)
  }

  /**
   * Convert payment-related errors
   */
  static convertPaymentError(error: unknown): ApiError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()

      if (message.includes('card declined') || message.includes('insufficient funds')) {
        return new BusinessLogicError('Payment declined by card issuer')
      }

      if (message.includes('expired card')) {
        return new ValidationError('Payment card has expired')
      }

      if (message.includes('invalid card')) {
        return new ValidationError('Invalid payment card information')
      }
    }

    return ErrorHandler.toApiError(error)
  }
}

/**
 * Async Error Handler Decorator
 *
 * Utility to wrap async functions with error handling
 */
export function asyncErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      throw ErrorHandler.toApiError(error)
    }
  }
}

/**
 * Type Guards for Error Handling
 */
export const ErrorTypeGuards = {
  isRetryableError(error: ApiError): boolean {
    return [503, 429, 502, 504].includes(error.statusCode)
  },

  isClientError(error: ApiError): boolean {
    return error.statusCode >= 400 && error.statusCode < 500
  },

  isServerError(error: ApiError): boolean {
    return error.statusCode >= 500
  },

  requiresAuth(error: ApiError): boolean {
    return error.statusCode === 401
  },

  isForbidden(error: ApiError): boolean {
    return error.statusCode === 403
  }
}