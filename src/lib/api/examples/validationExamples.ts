/**
 * Validation Middleware Usage Examples
 *
 * Demonstrates how to use the validation middleware system
 * in real API routes with comprehensive examples.
 *
 * These examples show:
 * - Basic validation setup
 * - Complex validation scenarios
 * - Error handling integration
 * - Type safety benefits
 * - Performance considerations
 */

import { z } from 'zod'
import {
  withValidation,
  DomainValidationSchemas,
  CommonValidationSchemas,
  ValidationMiddleware,
  ResponseHelpers,
  ErrorHelpers,
  type ValidatedRequest
} from '../index'

// ===== EXAMPLE 1: Basic User Registration =====

/**
 * User registration with comprehensive validation
 * Validates email, password strength, and required fields
 */
export const userRegistrationHandler = withValidation({
  body: DomainValidationSchemas.user.register
})(async (request: ValidatedRequest) => {
  // Type-safe access to validated data
  const { email, password, firstName, lastName, phone, role } = request.validatedData.body

  // Your business logic here - data is guaranteed to be valid
  const user = await createUser({
    email,
    password,
    firstName,
    lastName,
    phone,
    role
  })

  return ResponseHelpers.created(user, `/api/users/${user.id}`)
})

// ===== EXAMPLE 2: Booking Creation with Complex Validation =====

/**
 * Create booking with business logic validation
 * Validates time slots, barber availability, and booking constraints
 */
const createBookingSchema = z.object({
  barberId: CommonValidationSchemas.uuid,
  serviceId: CommonValidationSchemas.uuid,
  scheduledFor: z.string().datetime(),
  notes: z.string().max(500).optional()
}).refine(async (data) => {
  // Custom async validation for business rules
  const isAvailable = await checkBarberAvailability(data.barberId, data.scheduledFor)
  return isAvailable
}, {
  message: 'Barber is not available at the selected time',
  path: ['scheduledFor']
})

export const createBookingHandler = withValidation({
  body: createBookingSchema,
  response: z.object({
    id: z.string(),
    barberId: z.string(),
    serviceId: z.string(),
    scheduledFor: z.string(),
    status: z.enum(['pending', 'confirmed']),
    totalAmount: z.number(),
    createdAt: z.string()
  })
}, {
  validateResponse: true,
  mode: 'strict'
})(async (request: ValidatedRequest) => {
  const { barberId, serviceId, scheduledFor, notes } = request.validatedData.body

  // Get user from auth context (would come from auth middleware)
  const userId = 'user-id-from-auth-context'

  const booking = await createBooking({
    userId,
    barberId,
    serviceId,
    scheduledFor: new Date(scheduledFor),
    notes
  })

  return ResponseHelpers.created(booking)
})

// ===== EXAMPLE 3: Barber Search with Geolocation =====

/**
 * Search barbers with location-based filtering
 * Handles both address search and coordinate-based search
 */
const barberSearchSchema = z.object({
  // Location can be either address or coordinates
  location: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(50).default(10),
  service: z.string().optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  rating: z.coerce.number().min(1).max(5).optional(),
  availability: z.string().datetime().optional(),
  ...CommonValidationSchemas.pagination.shape
}).refine((data) => {
  // Either location string OR coordinates must be provided
  return data.location || (data.latitude && data.longitude)
}, {
  message: 'Either location address or coordinates (latitude & longitude) must be provided',
  path: ['location']
})

export const searchBarbersHandler = withValidation({
  query: barberSearchSchema
})(async (request: ValidatedRequest) => {
  const searchParams = request.validatedData.query

  // Convert location to coordinates if needed
  let coordinates = { latitude: searchParams.latitude, longitude: searchParams.longitude }

  if (searchParams.location && !coordinates.latitude) {
    coordinates = await geocodeAddress(searchParams.location)
  }

  const barbers = await searchBarbers({
    ...searchParams,
    ...coordinates
  })

  const total = await countSearchResults(searchParams)

  return ResponseHelpers.paginated(barbers, {
    page: searchParams.page,
    limit: searchParams.limit,
    total
  })
})

// ===== EXAMPLE 4: File Upload with Validation =====

/**
 * Handle file uploads with size and type validation
 */
const fileUploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= 5 * 1024 * 1024, // 5MB max
    'File size must be less than 5MB'
  ).refine(
    (file) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.type),
    'Only JPEG, PNG, and WebP images are allowed'
  ),
  description: z.string().max(200).optional()
})

export const uploadFileHandler = withValidation({
  body: fileUploadSchema
})(async (request: ValidatedRequest) => {
  const { file, description } = request.validatedData.body

  // Upload to cloud storage
  const uploadResult = await uploadToCloudStorage(file)

  return ResponseHelpers.created({
    id: uploadResult.id,
    url: uploadResult.url,
    filename: file.name,
    size: file.size,
    contentType: file.type,
    description
  })
})

// ===== EXAMPLE 5: Conditional Validation =====

/**
 * Update user profile with conditional validation
 * Different validation rules based on user role
 */
const updateUserProfileSchema = z.discriminatedUnion('role', [
  // Customer profile update
  z.object({
    role: z.literal('customer'),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: CommonValidationSchemas.phoneNumber.optional(),
    avatar: z.string().url().optional()
  }),
  // Barber profile update
  z.object({
    role: z.literal('barber'),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: CommonValidationSchemas.phoneNumber.optional(),
    avatar: z.string().url().optional(),
    businessName: z.string().min(1).optional(),
    description: z.string().max(1000).optional(),
    address: z.string().min(1).optional(),
    coordinates: CommonValidationSchemas.coordinates.optional(),
    website: z.string().url().optional(),
    socialMedia: z.object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      twitter: z.string().optional()
    }).optional()
  })
])

export const updateUserProfileHandler = withValidation({
  body: updateUserProfileSchema
})(async (request: ValidatedRequest) => {
  const profileData = request.validatedData.body
  const userId = 'user-id-from-auth-context'

  // Type-safe handling based on role
  if (profileData.role === 'barber') {
    // TypeScript knows this has barber-specific fields
    const updatedProfile = await updateBarberProfile(userId, profileData)
    return ResponseHelpers.updated(updatedProfile)
  } else {
    // TypeScript knows this has customer-specific fields
    const updatedProfile = await updateCustomerProfile(userId, profileData)
    return ResponseHelpers.updated(updatedProfile)
  }
})

// ===== EXAMPLE 6: Batch Operations with Array Validation =====

/**
 * Batch update bookings with array validation
 */
const batchUpdateBookingsSchema = z.object({
  updates: z.array(z.object({
    id: CommonValidationSchemas.uuid,
    status: z.enum(['confirmed', 'cancelled']).optional(),
    notes: z.string().max(500).optional()
  })).min(1).max(50) // Allow 1-50 updates at once
})

export const batchUpdateBookingsHandler = withValidation({
  body: batchUpdateBookingsSchema
})(async (request: ValidatedRequest) => {
  const { updates } = request.validatedData.body
  const userId = 'user-id-from-auth-context'

  // Process updates in parallel
  const results = await Promise.allSettled(
    updates.map((update: any) => updateBooking(update.id, update, userId))
  )

  const successful = results.filter(result => result.status === 'fulfilled').length
  const failed = results.length - successful

  return ResponseHelpers.success({
    total: results.length,
    successful,
    failed,
    results: results.map((result, index) => ({
      id: updates[index].id,
      success: result.status === 'fulfilled',
      error: result.status === 'rejected' ? result.reason.message : undefined
    }))
  })
})

// ===== EXAMPLE 7: Using Middleware Factories =====

/**
 * Using pre-built validation middleware factories
 */

// Simple pagination endpoint
export const getPaginatedBookingsHandler = ValidationMiddleware.pagination()(
  async (request: ValidatedRequest) => {
    const { page, limit, sort, order } = request.validatedData.query

    const bookings = await getBookings({
      page,
      limit,
      sort,
      order
    })

    const total = await countBookings()

    return ResponseHelpers.paginated(bookings, { page, limit, total })
  }
)

// JSON body only validation
export const simpleCreateHandler = ValidationMiddleware.jsonBody(
  z.object({
    title: z.string().min(1),
    description: z.string().optional()
  })
)(async (request: ValidatedRequest) => {
  const { title, description } = request.validatedData.body

  const item = await createItem({ title, description })
  return ResponseHelpers.created(item)
})

// ===== EXAMPLE 8: Error Handling Integration =====

/**
 * Advanced error handling with validation
 */
export const advancedValidationHandler = withValidation({
  body: z.object({
    email: CommonValidationSchemas.email,
    data: z.object({
      preferences: z.record(z.string(), z.unknown())
    })
  })
}, {
  customErrorMessages: {
    'email': 'Please provide a valid email address',
    'data.preferences': 'Preferences must be a valid object'
  }
})(async (request: ValidatedRequest) => {
  try {
    const { email, data } = request.validatedData.body

    // Business logic that might throw domain-specific errors
    const result = await processUserData(email, data)

    return ResponseHelpers.success(result)
  } catch (error) {
    // Custom error handling for business logic errors
    if (error instanceof BusinessLogicError) {
      return ErrorHelpers.businessLogic(error.message)
    }

    if (error instanceof ConflictError) {
      return ErrorHelpers.conflict(error.message)
    }

    // Let the error middleware handle other types
    throw error
  }
})

// ===== Utility Functions (Mock implementations) =====

async function createUser(userData: any) {
  // Mock implementation
  return { id: 'user-123', ...userData, createdAt: new Date().toISOString() }
}

async function checkBarberAvailability(_barberId: string, _scheduledFor: string): Promise<boolean> {
  // Mock implementation
  return true
}

async function createBooking(bookingData: any) {
  // Mock implementation
  return {
    id: 'booking-123',
    ...bookingData,
    status: 'pending',
    totalAmount: 50.00,
    createdAt: new Date().toISOString()
  }
}

async function geocodeAddress(_address: string) {
  // Mock implementation
  return { latitude: 40.7128, longitude: -74.0060 }
}

async function searchBarbers(_params: any) {
  // Mock implementation
  return []
}

async function countSearchResults(_params: any): Promise<number> {
  // Mock implementation
  return 0
}

async function uploadToCloudStorage(_file: File) {
  // Mock implementation
  return { id: 'file-123', url: 'https://example.com/file-123' }
}

async function updateBarberProfile(userId: string, profileData: any) {
  // Mock implementation
  return { id: userId, ...profileData, updatedAt: new Date().toISOString() }
}

async function updateCustomerProfile(userId: string, profileData: any) {
  // Mock implementation
  return { id: userId, ...profileData, updatedAt: new Date().toISOString() }
}

async function updateBooking(bookingId: string, updateData: any, _userId: string) {
  // Mock implementation
  return { id: bookingId, ...updateData, updatedAt: new Date().toISOString() }
}

async function getBookings(_params: any) {
  // Mock implementation
  return []
}

async function countBookings(): Promise<number> {
  // Mock implementation
  return 0
}

async function createItem(itemData: any) {
  // Mock implementation
  return { id: 'item-123', ...itemData, createdAt: new Date().toISOString() }
}

async function processUserData(email: string, data: any) {
  // Mock implementation
  return { processed: true, email, data }
}

// Import business logic errors for the examples
class BusinessLogicError extends Error {}
class ConflictError extends Error {}