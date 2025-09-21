/**
 * Standardized API Response Format
 *
 * Provides consistent response structure across all API endpoints
 * Implements RFC 7807 Problem Details for HTTP APIs standards
 *
 * @example
 * ```typescript
 * // Success response
 * return ApiResponse.success({ user: userData }, 'User created successfully', 201)
 *
 * // Error response
 * return ApiResponse.error('User not found', 404, 'USER_NOT_FOUND')
 *
 * // Paginated response
 * return ApiResponse.paginated(users, { page: 1, limit: 10, total: 100 })
 * ```
 */

import { NextResponse } from 'next/server'

export interface ApiResponseMeta {
  timestamp: string
  requestId?: string
  version: string
  executionTime?: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  message?: string
  meta: ApiResponseMeta
  pagination?: PaginationMeta
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, any>
    stack?: string
  }
  meta: ApiResponseMeta
}

export type ApiResponseType<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Standardized API Response Builder
 *
 * Ensures consistent response format across all endpoints
 * Provides type safety and proper HTTP status codes
 */
export class ApiResponse {
  private static readonly API_VERSION = 'v1'

  /**
   * Creates a standardized success response
   */
  static success<T>(
    data: T,
    message?: string,
    status: number = 200,
    requestId?: string,
    executionTime?: number
  ): NextResponse<ApiSuccessResponse<T>> {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      ...(message !== undefined && { message }),
      meta: {
        timestamp: new Date().toISOString(),
        ...(requestId !== undefined && { requestId }),
        version: this.API_VERSION,
        ...(executionTime !== undefined && { executionTime }),
      },
    }

    return NextResponse.json(response, { status })
  }

  /**
   * Creates a standardized paginated response
   */
  static paginated<T>(
    data: T[],
    pagination: PaginationMeta,
    message?: string,
    requestId?: string,
    executionTime?: number
  ): NextResponse<ApiSuccessResponse<T[]>> {
    const response: ApiSuccessResponse<T[]> = {
      success: true,
      data,
      ...(message !== undefined && { message }),
      pagination,
      meta: {
        timestamp: new Date().toISOString(),
        ...(requestId !== undefined && { requestId }),
        version: this.API_VERSION,
        ...(executionTime !== undefined && { executionTime }),
      },
    }

    return NextResponse.json(response, { status: 200 })
  }

  /**
   * Creates a standardized error response
   */
  static error(
    message: string,
    status: number = 500,
    code?: string,
    details?: Record<string, any>,
    requestId?: string,
    includeStack: boolean = process.env.NODE_ENV === 'development'
  ): NextResponse<ApiErrorResponse> {
    const error = new Error(message)

    const response: ApiErrorResponse = {
      success: false,
      error: {
        code: code || this.getDefaultErrorCode(status),
        message,
        ...(details !== undefined && { details }),
        ...(includeStack && error.stack && { stack: error.stack }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        ...(requestId !== undefined && { requestId }),
        version: this.API_VERSION,
      },
    }

    return NextResponse.json(response, { status })
  }

  /**
   * Creates a validation error response
   */
  static validationError(
    message: string = 'Validation failed',
    details: Record<string, any>,
    requestId?: string
  ): NextResponse<ApiErrorResponse> {
    return this.error(message, 400, 'VALIDATION_ERROR', details, requestId)
  }

  /**
   * Creates an authentication error response
   */
  static unauthorized(
    message: string = 'Authentication required',
    requestId?: string
  ): NextResponse<ApiErrorResponse> {
    return this.error(message, 401, 'UNAUTHORIZED', undefined, requestId)
  }

  /**
   * Creates a forbidden error response
   */
  static forbidden(
    message: string = 'Access denied',
    requestId?: string
  ): NextResponse<ApiErrorResponse> {
    return this.error(message, 403, 'FORBIDDEN', undefined, requestId)
  }

  /**
   * Creates a not found error response
   */
  static notFound(
    message: string = 'Resource not found',
    requestId?: string
  ): NextResponse<ApiErrorResponse> {
    return this.error(message, 404, 'NOT_FOUND', undefined, requestId)
  }

  /**
   * Creates a conflict error response
   */
  static conflict(
    message: string = 'Resource conflict',
    details?: Record<string, any>,
    requestId?: string
  ): NextResponse<ApiErrorResponse> {
    return this.error(message, 409, 'CONFLICT', details, requestId)
  }

  /**
   * Creates a rate limit error response
   */
  static rateLimited(
    message: string = 'Rate limit exceeded',
    retryAfter?: number,
    requestId?: string
  ): NextResponse<ApiErrorResponse> {
    const details = retryAfter ? { retryAfter } : undefined
    return this.error(message, 429, 'RATE_LIMITED', details, requestId)
  }

  /**
   * Creates an internal server error response
   */
  static internalError(
    message: string = 'Internal server error',
    requestId?: string,
    details?: Record<string, any>
  ): NextResponse<ApiErrorResponse> {
    return this.error(message, 500, 'INTERNAL_ERROR', details, requestId)
  }

  /**
   * Maps HTTP status codes to default error codes
   */
  private static getDefaultErrorCode(status: number): string {
    const codeMap: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMITED',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    }

    return codeMap[status] || 'UNKNOWN_ERROR'
  }

  /**
   * Helper to extract request ID from headers
   */
  static getRequestId(headers: Headers): string {
    return headers.get('x-request-id') || crypto.randomUUID()
  }

  /**
   * Helper to calculate execution time
   */
  static calculateExecutionTime(startTime: number): number {
    return Date.now() - startTime
  }
}

/**
 * Utility functions for working with API responses
 */
export class ApiResponseUtils {
  /**
   * Type guard to check if response is successful
   */
  static isSuccess<T>(response: ApiResponseType<T>): response is ApiSuccessResponse<T> {
    return response.success === true
  }

  /**
   * Type guard to check if response is an error
   */
  static isError(response: ApiResponseType): response is ApiErrorResponse {
    return response.success === false
  }

  /**
   * Extract data from response safely
   */
  static getData<T>(response: ApiResponseType<T>): T | null {
    return this.isSuccess(response) ? response.data : null
  }

  /**
   * Extract error message from response safely
   */
  static getErrorMessage(response: ApiResponseType): string | null {
    return this.isError(response) ? response.error.message : null
  }

  /**
   * Extract error code from response safely
   */
  static getErrorCode(response: ApiResponseType): string | null {
    return this.isError(response) ? response.error.code : null
  }
}

export default ApiResponse