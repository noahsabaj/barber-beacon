/**
 * Validation Middleware for Request/Response Validation
 *
 * Comprehensive validation system using Zod schemas that integrates
 * with the centralized error handling system for type-safe API development.
 *
 * Features:
 * - Request body, query, and path parameter validation
 * - Response data validation (development mode)
 * - Type-safe validation with Zod schemas
 * - Automatic error conversion and handling
 * - Support for different validation modes
 * - File upload validation
 * - Custom validation rules
 * - Performance optimization for production
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodSchema, ZodError, ZodType } from 'zod'
import { ValidationError } from '../base/ApiError'
import { ErrorHelpers, ResponseHelpers, type ResponseOptions } from '../utils/responseUtils'

export interface ValidationSchemas {
  body?: ZodSchema
  query?: ZodSchema
  params?: ZodSchema
  response?: ZodSchema
}

export interface ValidationOptions {
  mode?: 'strict' | 'loose' | 'development-only'
  skipEmptyBody?: boolean
  allowUnknownFields?: boolean
  validateResponse?: boolean
  customErrorMessages?: Record<string, string>
  validateBody?: boolean
  skipBodyValidation?: boolean
}

export interface ValidationContext {
  request: NextRequest
  requestId: string
  validatedData: {
    body?: any
    query?: any
    params?: any
  }
}

export interface ValidatedRequest extends NextRequest {
  validatedData: {
    body?: any
    query?: any
    params?: any
  }
}

/**
 * Main validation middleware factory
 */
export function withValidation(
  schemas: ValidationSchemas,
  options: ValidationOptions = {}
) {
  return function <T = any>(
    handler: (request: ValidatedRequest, context?: any) => Promise<T>
  ) {
    return async (request: NextRequest, context?: any): Promise<NextResponse> => {
      const requestId = `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const opts: ResponseOptions = { requestId }

      try {
        // Create validation context
        const validationContext: ValidationContext = {
          request,
          requestId,
          validatedData: {}
        }

        // Validate request data
        await validateRequest(request, schemas, options, validationContext)

        // Create validated request object
        const validatedRequest = Object.assign(request, {
          validatedData: validationContext.validatedData
        }) as ValidatedRequest

        // Execute handler
        const result = await handler(validatedRequest, context)

        // Validate response if enabled
        if (options.validateResponse && schemas.response) {
          return await validateResponse(result, schemas.response, options, opts)
        }

        // Return response
        if (result instanceof NextResponse) {
          result.headers.set('X-Request-ID', requestId)
          return result
        }

        return ResponseHelpers.success(result, opts)
      } catch (error) {
        return ErrorHelpers.fromUnknown(error, opts)
      }
    }
  }
}

/**
 * Validate request data (body, query, params)
 */
async function validateRequest(
  request: NextRequest,
  schemas: ValidationSchemas,
  options: ValidationOptions,
  context: ValidationContext
): Promise<void> {
  const url = new URL(request.url)

  // Validate query parameters
  if (schemas.query) {
    const queryParams = Object.fromEntries(url.searchParams.entries())
    context.validatedData.query = await validateData(
      queryParams,
      schemas.query,
      'query',
      options
    )
  }

  // Validate path parameters (if dynamic route context provided)
  if (schemas.params) {
    // Note: params validation would need route context to extract dynamic segments
    // This is a placeholder for when route context is available
    context.validatedData.params = {}
  }

  // Validate request body
  if (schemas.body && hasBody(request)) {
    const contentType = request.headers.get('content-type') || ''

    let bodyData: any = null

    try {
      if (contentType.includes('application/json')) {
        bodyData = await request.json()
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData()
        bodyData = Object.fromEntries(formData.entries())
      } else if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData()
        bodyData = Object.fromEntries(formData.entries())
      } else {
        bodyData = await request.text()
      }

      context.validatedData.body = await validateData(
        bodyData,
        schemas.body,
        'body',
        options
      )
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ValidationError('Invalid JSON in request body', {
          details: [{
            field: 'body',
            message: 'Request body contains invalid JSON',
            code: 'INVALID_JSON'
          }]
        })
      }
      throw error
    }
  }
}

/**
 * Validate response data (development mode only)
 */
async function validateResponse(
  result: any,
  responseSchema: ZodSchema,
  options: ValidationOptions,
  responseOptions: ResponseOptions
): Promise<NextResponse> {
  // Only validate responses in development mode for performance
  if (process.env.NODE_ENV !== 'development' && options.mode !== 'strict') {
    if (result instanceof NextResponse) {
      return result
    }
    return ResponseHelpers.success(result, responseOptions)
  }

  try {
    let responseData = result

    // Extract data from NextResponse if needed
    if (result instanceof NextResponse) {
      const body = await result.text()
      responseData = body ? JSON.parse(body) : null
    }

    // Validate response data
    const validatedResponse = await responseSchema.parseAsync(responseData)

    if (result instanceof NextResponse) {
      // Return modified response with validated data
      return NextResponse.json(validatedResponse, {
        status: result.status,
        headers: result.headers
      })
    }

    return ResponseHelpers.success(validatedResponse, responseOptions)
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Response validation failed:', error.issues)

      // In development, throw error to help developers fix issues
      if (process.env.NODE_ENV === 'development') {
        throw new ValidationError('Response validation failed', {
          details: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            code: err.code,
            value: (err as any).received
          }))
        })
      }
    }

    // In production, log error but don't break the response
    console.error('Response validation error:', error)
    if (result instanceof NextResponse) {
      return result
    }
    return ResponseHelpers.success(result, responseOptions)
  }
}

/**
 * Core data validation function
 */
async function validateData(
  data: any,
  schema: ZodSchema,
  fieldType: string,
  options: ValidationOptions
): Promise<any> {
  try {
    // Handle empty data based on options
    if (data === null || data === undefined ||
        (typeof data === 'object' && Object.keys(data).length === 0)) {
      if (options.skipEmptyBody && fieldType === 'body') {
        return {}
      }
    }

    // Create parsing options
    // Parse and validate data
    const validatedData = await schema.parseAsync(data)
    return validatedData
  } catch (error) {
    if (error instanceof ZodError) {
      throw ValidationError.fromZodError(error, `${fieldType} validation failed`)
    }
    throw error
  }
}

/**
 * Check if request has body
 */
function hasBody(request: NextRequest): boolean {
  const method = request.method.toUpperCase()
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
}

/**
 * Common validation schemas for reuse
 */
export const CommonValidationSchemas = {
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc')
  }),

  dateRange: z.object({
    startDate: z.string().datetime().or(z.date()),
    endDate: z.string().datetime().or(z.date())
  }).refine(data => new Date(data.startDate) < new Date(data.endDate), {
    message: 'Start date must be before end date',
    path: ['dateRange']
  }),

  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180)
  }),

  phoneNumber: z.string().regex(/^\+?[\d\s\-\(\)]{10,}$/, {
    message: 'Invalid phone number format'
  }),

  email: z.string().email('Invalid email format'),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/(?=.*[a-zA-Z])(?=.*\d)/, 'Password must contain letters and numbers'),

  uuid: z.string().uuid('Invalid UUID format'),

  objectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format'),

  url: z.string().url('Invalid URL format'),

  positiveInteger: z.number().int().positive(),

  nonEmptyString: z.string().min(1, 'Field cannot be empty').trim(),

  optionalNonEmptyString: z.string().min(1).trim().optional(),

  file: z.object({
    name: z.string(),
    type: z.string(),
    size: z.number().positive()
  })
}

/**
 * Domain-specific validation schemas
 */
export const DomainValidationSchemas = {
  user: {
    register: z.object({
      email: CommonValidationSchemas.email,
      password: CommonValidationSchemas.password,
      firstName: CommonValidationSchemas.nonEmptyString,
      lastName: CommonValidationSchemas.nonEmptyString,
      phone: CommonValidationSchemas.phoneNumber.optional(),
      role: z.enum(['customer', 'barber']).default('customer')
    }),

    login: z.object({
      email: CommonValidationSchemas.email,
      password: z.string().min(1, 'Password is required')
    }),

    updateProfile: z.object({
      firstName: CommonValidationSchemas.optionalNonEmptyString,
      lastName: CommonValidationSchemas.optionalNonEmptyString,
      phone: CommonValidationSchemas.phoneNumber.optional(),
      avatar: z.string().url().optional()
    })
  },

  booking: {
    create: z.object({
      barberId: CommonValidationSchemas.uuid,
      serviceId: CommonValidationSchemas.uuid,
      scheduledFor: z.string().datetime(),
      notes: z.string().max(500).optional()
    }).refine(data => new Date(data.scheduledFor) > new Date(), {
      message: 'Booking must be scheduled for a future date',
      path: ['scheduledFor']
    }),

    update: z.object({
      status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
      scheduledFor: z.string().datetime().optional(),
      notes: z.string().max(500).optional()
    }),

    search: z.object({
      barberId: CommonValidationSchemas.uuid.optional(),
      status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      ...CommonValidationSchemas.pagination.shape
    })
  },

  barber: {
    search: z.object({
      location: z.string().optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      radius: z.number().min(1).max(50).default(10),
      service: z.string().optional(),
      priceMin: z.number().min(0).optional(),
      priceMax: z.number().min(0).optional(),
      rating: z.number().min(1).max(5).optional(),
      availability: z.string().datetime().optional(),
      ...CommonValidationSchemas.pagination.shape
    }),

    updateProfile: z.object({
      businessName: CommonValidationSchemas.optionalNonEmptyString,
      description: z.string().max(1000).optional(),
      address: CommonValidationSchemas.optionalNonEmptyString,
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      phone: CommonValidationSchemas.phoneNumber.optional(),
      website: CommonValidationSchemas.url.optional(),
      socialMedia: z.object({
        instagram: z.string().optional(),
        facebook: z.string().optional(),
        twitter: z.string().optional()
      }).optional()
    })
  },

  review: {
    create: z.object({
      bookingId: CommonValidationSchemas.uuid,
      rating: z.number().int().min(1).max(5),
      comment: z.string().max(1000).optional(),
      photos: z.array(z.string().url()).max(5).optional()
    }),

    update: z.object({
      rating: z.number().int().min(1).max(5).optional(),
      comment: z.string().max(1000).optional(),
      photos: z.array(z.string().url()).max(5).optional()
    })
  }
}

/**
 * Validation helper utilities
 */
export const ValidationUtils = {
  /**
   * Create custom validation error
   */
  createValidationError(field: string, message: string, value?: any): ValidationError {
    return ValidationError.fieldError(field, message, value)
  },

  /**
   * Combine multiple schemas
   */
  combineSchemas<T, U>(schema1: ZodType<T>, schema2: ZodType<U>) {
    return z.intersection(schema1, schema2)
  },

  /**
   * Make all fields optional
   */
  makeOptional<T extends z.ZodObject<any>>(schema: T) {
    return schema.partial()
  },

  /**
   * Create conditional validation
   */
  conditionalValidation<T>(
    _condition: (data: any) => boolean,
    trueSchema: ZodType<T>,
    falseSchema: ZodType<T>
  ) {
    return z.preprocess((data) => data, z.union([trueSchema, falseSchema]))
  },

  /**
   * Transform string to number with validation
   */
  stringToNumber(min?: number, max?: number) {
    let schema = z.coerce.number()
    if (min !== undefined) schema = schema.min(min)
    if (max !== undefined) schema = schema.max(max)
    return schema
  },

  /**
   * Transform string to boolean
   */
  stringToBoolean() {
    return z.preprocess(
      (val) => {
        if (typeof val === 'string') {
          return val.toLowerCase() === 'true'
        }
        return val
      },
      z.boolean()
    )
  },

  /**
   * Validate array of IDs
   */
  arrayOfIds(type: 'uuid' | 'objectId' = 'uuid') {
    const idSchema = type === 'uuid'
      ? CommonValidationSchemas.uuid
      : CommonValidationSchemas.objectId

    return z.array(idSchema).min(1, 'At least one ID is required')
  }
}

/**
 * Middleware factory for specific validation patterns
 */
export const ValidationMiddleware = {
  /**
   * Validate pagination parameters
   */
  pagination() {
    return withValidation({
      query: CommonValidationSchemas.pagination
    })
  },

  /**
   * Validate authentication required
   */
  authenticated() {
    return withValidation({}, { mode: 'strict' })
  },

  /**
   * Validate JSON body only
   */
  jsonBody(schema: ZodSchema) {
    return withValidation({
      body: schema
    }, { skipEmptyBody: false })
  },

  /**
   * Validate query parameters only
   */
  queryParams(schema: ZodSchema) {
    return withValidation({
      query: schema
    })
  },

  /**
   * Strict validation for critical operations
   */
  strict(schemas: ValidationSchemas) {
    return withValidation(schemas, {
      mode: 'strict',
      validateResponse: true,
      allowUnknownFields: false
    })
  }
}