/**
 * Booking API Validation Schemas
 *
 * Comprehensive Zod schemas for all booking-related endpoints.
 * Designed to work with the validation middleware and provide type safety.
 *
 * Features:
 * - Request/response validation for all booking endpoints
 * - Business logic validation (time slots, availability, etc.)
 * - Payment integration validation
 * - Booking status lifecycle validation
 * - Timezone and scheduling validation
 * - Custom error messages and transformations
 */

import { z } from 'zod'

// ===== COMMON VALIDATION SCHEMAS =====

export const bookingStatusSchema = z.enum([
  'pending',
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
  'no_show'
])

export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'paid',
  'failed',
  'refunded',
  'partial_refund'
])

export const bookingDateTimeSchema = z
  .string()
  .datetime('Invalid date format')
  .refine((dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    return date > now
  }, 'Booking date must be in the future')
  .refine((dateStr) => {
    const date = new Date(dateStr)
    const dayOfWeek = date.getDay()
    return dayOfWeek >= 1 && dayOfWeek <= 6 // Monday (1) to Saturday (6)
  }, 'Bookings are only allowed Monday through Saturday')
  .refine((dateStr) => {
    const date = new Date(dateStr)
    const hour = date.getHours()
    return hour >= 9 && hour <= 18 // 9 AM to 6 PM
  }, 'Bookings are only allowed between 9 AM and 6 PM')

export const uuidSchema = z.string().uuid('Invalid UUID format')

export const priceSchema = z
  .number()
  .positive('Price must be positive')
  .max(1000, 'Price cannot exceed $1000')
  .multipleOf(0.01, 'Price must be to the nearest cent')

export const durationSchema = z
  .number()
  .int('Duration must be a whole number')
  .min(15, 'Minimum duration is 15 minutes')
  .max(480, 'Maximum duration is 8 hours')
  .multipleOf(15, 'Duration must be in 15-minute increments')

export const notesSchema = z
  .string()
  .max(500, 'Notes must be less than 500 characters')
  .optional()

export const tipAmountSchema = z
  .number()
  .min(0, 'Tip cannot be negative')
  .max(200, 'Tip cannot exceed $200')
  .multipleOf(0.01, 'Tip must be to the nearest cent')
  .optional()

// ===== CREATE BOOKING SCHEMAS =====

export const createBookingRequestSchema = z.object({
  barberId: uuidSchema,
  serviceId: uuidSchema,
  dateTime: bookingDateTimeSchema,
  notes: notesSchema,
  preferredPaymentMethod: z.enum(['card', 'cash', 'digital_wallet']).optional().default('card'),
  reminderPreferences: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(true),
    push: z.boolean().default(true),
    timeBeforeInMinutes: z.number().int().min(15).max(1440).default(60) // 15 min to 24 hours
  }).optional()
}).refine(async (_data) => {
  // This would be implemented in the API route with actual database queries
  // Validate that service belongs to barber
  return true
}, {
  message: 'Service does not belong to the specified barber',
  path: ['serviceId']
})

export const createBookingResponseSchema = z.object({
  booking: z.object({
    id: uuidSchema,
    customerId: uuidSchema,
    barberId: uuidSchema,
    serviceId: uuidSchema,
    dateTime: z.string().datetime(),
    endTime: z.string().datetime(),
    status: bookingStatusSchema,
    paymentStatus: paymentStatusSchema,
    totalAmount: priceSchema,
    notes: z.string().optional(),
    createdAt: z.string().datetime(),
    customer: z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().email(),
      phone: z.string().optional()
    }),
    barber: z.object({
      businessName: z.string().optional(),
      user: z.object({
        firstName: z.string(),
        lastName: z.string()
      })
    }),
    service: z.object({
      name: z.string(),
      duration: durationSchema,
      price: priceSchema,
      category: z.string().optional()
    })
  }),
  clientSecret: z.string().optional(), // Stripe payment intent client secret
  estimatedEndTime: z.string().datetime(),
  cancelDeadline: z.string().datetime()
})

// ===== GET BOOKINGS LIST SCHEMAS =====

export const getBookingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: bookingStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  barberId: uuidSchema.optional(),
  serviceId: uuidSchema.optional(),
  sortBy: z.enum(['dateTime', 'createdAt', 'totalAmount', 'status']).default('dateTime'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  includeReviews: z.boolean().default(false),
  includePayments: z.boolean().default(false),
  search: z.string().max(100).optional() // Search by customer name, service name, etc.
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate)
  }
  return true
}, {
  message: 'Start date must be before or equal to end date',
  path: ['endDate']
})

export const bookingListItemSchema = z.object({
  id: uuidSchema,
  customerId: uuidSchema,
  barberId: uuidSchema,
  serviceId: uuidSchema,
  dateTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: bookingStatusSchema,
  paymentStatus: paymentStatusSchema,
  totalAmount: priceSchema,
  tipAmount: tipAmountSchema,
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  customer: z.object({
    id: uuidSchema,
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    avatar: z.string().url().optional()
  }),
  barber: z.object({
    id: uuidSchema,
    businessName: z.string().optional(),
    averageRating: z.number().min(0).max(5).optional(),
    user: z.object({
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string().optional()
    })
  }),
  service: z.object({
    id: uuidSchema,
    name: z.string(),
    duration: durationSchema,
    price: priceSchema,
    category: z.string().optional(),
    description: z.string().optional()
  }),
  payment: z.object({
    id: uuidSchema,
    amount: priceSchema,
    status: paymentStatusSchema,
    paymentMethod: z.string(),
    transactionId: z.string().optional(),
    processedAt: z.string().datetime().optional()
  }).optional(),
  review: z.object({
    id: uuidSchema,
    rating: z.number().int().min(1).max(5),
    comment: z.string().optional(),
    createdAt: z.string().datetime()
  }).optional()
})

export const getBookingsResponseSchema = z.object({
  bookings: z.array(bookingListItemSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNext: z.boolean(),
    hasPrev: z.boolean()
  }),
  summary: z.object({
    totalBookings: z.number().int().min(0),
    upcomingBookings: z.number().int().min(0),
    completedBookings: z.number().int().min(0),
    canceledBookings: z.number().int().min(0),
    totalRevenue: z.number().min(0)
  }).optional()
})

// ===== GET SINGLE BOOKING SCHEMAS =====

export const getBookingParamsSchema = z.object({
  id: uuidSchema
})

export const getBookingResponseSchema = z.object({
  booking: z.object({
    id: uuidSchema,
    customerId: uuidSchema,
    barberId: uuidSchema,
    serviceId: uuidSchema,
    dateTime: z.string().datetime(),
    endTime: z.string().datetime(),
    status: bookingStatusSchema,
    paymentStatus: paymentStatusSchema,
    totalAmount: priceSchema,
    tipAmount: tipAmountSchema,
    notes: z.string().optional(),
    cancellationReason: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    customer: z.object({
      id: uuidSchema,
      firstName: z.string(),
      lastName: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      avatar: z.string().url().optional(),
      preferences: z.object({
        notifications: z.object({
          email: z.boolean(),
          sms: z.boolean()
        })
      }).optional()
    }),
    barber: z.object({
      id: uuidSchema,
      businessName: z.string().optional(),
      description: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      website: z.string().url().optional(),
      averageRating: z.number().min(0).max(5).optional(),
      totalReviews: z.number().int().min(0).optional(),
      user: z.object({
        id: uuidSchema,
        firstName: z.string(),
        lastName: z.string(),
        phone: z.string().optional()
      })
    }),
    service: z.object({
      id: uuidSchema,
      name: z.string(),
      description: z.string().optional(),
      duration: durationSchema,
      price: priceSchema,
      category: z.string().optional()
    }),
    payment: z.object({
      id: uuidSchema,
      amount: priceSchema,
      tipAmount: tipAmountSchema,
      totalAmount: priceSchema,
      status: paymentStatusSchema,
      paymentMethod: z.string(),
      transactionId: z.string().optional(),
      stripePaymentIntentId: z.string().optional(),
      processedAt: z.string().datetime().optional(),
      refundedAt: z.string().datetime().optional(),
      refundAmount: z.number().min(0).optional()
    }).optional(),
    review: z.object({
      id: uuidSchema,
      rating: z.number().int().min(1).max(5),
      comment: z.string().optional(),
      photos: z.array(z.string().url()).optional(),
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime()
    }).optional()
  })
})

// ===== UPDATE BOOKING SCHEMAS =====

export const updateBookingParamsSchema = z.object({
  id: uuidSchema
})

export const updateBookingRequestSchema = z.object({
  status: bookingStatusSchema.optional(),
  dateTime: bookingDateTimeSchema.optional(),
  notes: notesSchema,
  tipAmount: tipAmountSchema,
  cancellationReason: z.string().max(200).optional()
}).refine((data) => {
  // If status is canceled, cancellation reason should be provided
  if (data.status === 'canceled') {
    return data.cancellationReason && data.cancellationReason.length > 0
  }
  return true
}, {
  message: 'Cancellation reason is required when canceling a booking',
  path: ['cancellationReason']
}).refine((data) => {
  // If rescheduling (changing dateTime), status should remain scheduled
  if (data.dateTime) {
    return !data.status || data.status === 'scheduled'
  }
  return true
}, {
  message: 'Cannot change status when rescheduling',
  path: ['status']
})

export const updateBookingResponseSchema = z.object({
  booking: bookingListItemSchema,
  message: z.string().optional(),
  requiresPayment: z.boolean().optional(),
  newClientSecret: z.string().optional() // If rescheduling requires additional payment
})

// ===== RESCHEDULE BOOKING SCHEMAS =====

export const rescheduleBookingRequestSchema = z.object({
  newDateTime: bookingDateTimeSchema,
  reason: z.string().max(200).optional(),
  notifyCustomer: z.boolean().default(true)
}).refine(async (_data) => {
  // This would be implemented in the API route
  // Check availability at new time slot
  return true
}, {
  message: 'Selected time slot is not available',
  path: ['newDateTime']
})

// ===== CANCEL BOOKING SCHEMAS =====

export const cancelBookingRequestSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(200),
  requestRefund: z.boolean().default(true),
  notifyOtherParty: z.boolean().default(true)
})

export const cancelBookingResponseSchema = z.object({
  booking: bookingListItemSchema,
  refund: z.object({
    amount: z.number().min(0),
    processingTime: z.string(),
    refundId: z.string()
  }).optional(),
  cancellationFee: z.number().min(0).optional()
})

// ===== BOOKING AVAILABILITY SCHEMAS =====

export const checkAvailabilityRequestSchema = z.object({
  barberId: uuidSchema,
  serviceId: uuidSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  duration: durationSchema.optional() // If not provided, use service duration
})

export const availabilitySlotSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isAvailable: z.boolean(),
  price: priceSchema.optional(),
  reason: z.string().optional() // Why slot is unavailable
})

export const checkAvailabilityResponseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  barberId: uuidSchema,
  serviceId: uuidSchema,
  duration: durationSchema,
  timeSlots: z.array(availabilitySlotSchema),
  businessHours: z.object({
    open: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
    close: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
    isOpen: z.boolean()
  }),
  nextAvailableDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
})

// ===== BOOKING STATISTICS SCHEMAS =====

export const bookingStatsQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  barberId: uuidSchema.optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day')
}).refine((data) => {
  return new Date(data.startDate) <= new Date(data.endDate)
}, {
  message: 'Start date must be before or equal to end date',
  path: ['endDate']
})

export const bookingStatsResponseSchema = z.object({
  period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  summary: z.object({
    totalBookings: z.number().int().min(0),
    completedBookings: z.number().int().min(0),
    canceledBookings: z.number().int().min(0),
    noShowBookings: z.number().int().min(0),
    totalRevenue: z.number().min(0),
    averageBookingValue: z.number().min(0),
    completionRate: z.number().min(0).max(100)
  }),
  chartData: z.array(z.object({
    date: z.string(),
    bookings: z.number().int().min(0),
    revenue: z.number().min(0),
    completionRate: z.number().min(0).max(100)
  })),
  topServices: z.array(z.object({
    serviceId: uuidSchema,
    serviceName: z.string(),
    bookingCount: z.number().int().min(0),
    revenue: z.number().min(0)
  }))
})

// ===== BOOKING REMINDERS SCHEMAS =====

export const bookingReminderSchema = z.object({
  bookingId: uuidSchema,
  type: z.enum(['email', 'sms', 'push']),
  scheduledFor: z.string().datetime(),
  sent: z.boolean(),
  sentAt: z.string().datetime().optional()
})

export const updateReminderPreferencesSchema = z.object({
  email: z.boolean().default(true),
  sms: z.boolean().default(true),
  push: z.boolean().default(true),
  timeBeforeInMinutes: z.number().int().min(15).max(1440).default(60)
})

// ===== BATCH OPERATIONS SCHEMAS =====

export const batchUpdateBookingsSchema = z.object({
  bookingIds: z.array(uuidSchema).min(1).max(50),
  updates: z.object({
    status: bookingStatusSchema.optional(),
    notes: notesSchema
  }),
  reason: z.string().max(200).optional()
})

export const batchUpdateBookingsResponseSchema = z.object({
  successCount: z.number().int().min(0),
  failureCount: z.number().int().min(0),
  results: z.array(z.object({
    bookingId: uuidSchema,
    success: z.boolean(),
    error: z.string().optional()
  }))
})

// ===== VALIDATION SCHEMA COLLECTIONS =====

export const BookingValidationSchemas = {
  // Create booking
  createBooking: {
    body: createBookingRequestSchema,
    response: createBookingResponseSchema
  },

  // Get bookings list
  getBookings: {
    query: getBookingsQuerySchema,
    response: getBookingsResponseSchema
  },

  // Get single booking
  getBooking: {
    params: getBookingParamsSchema,
    response: getBookingResponseSchema
  },

  // Update booking
  updateBooking: {
    params: updateBookingParamsSchema,
    body: updateBookingRequestSchema,
    response: updateBookingResponseSchema
  },

  // Reschedule booking
  rescheduleBooking: {
    params: updateBookingParamsSchema,
    body: rescheduleBookingRequestSchema,
    response: updateBookingResponseSchema
  },

  // Cancel booking
  cancelBooking: {
    params: updateBookingParamsSchema,
    body: cancelBookingRequestSchema,
    response: cancelBookingResponseSchema
  },

  // Check availability
  checkAvailability: {
    query: checkAvailabilityRequestSchema,
    response: checkAvailabilityResponseSchema
  },

  // Booking statistics
  bookingStats: {
    query: bookingStatsQuerySchema,
    response: bookingStatsResponseSchema
  },

  // Update reminder preferences
  updateReminders: {
    body: updateReminderPreferencesSchema
  },

  // Batch operations
  batchUpdate: {
    body: batchUpdateBookingsSchema,
    response: batchUpdateBookingsResponseSchema
  }
}

// ===== TYPE EXPORTS =====

export type BookingStatus = z.infer<typeof bookingStatusSchema>
export type PaymentStatus = z.infer<typeof paymentStatusSchema>
export type CreateBookingRequest = z.infer<typeof createBookingRequestSchema>
export type CreateBookingResponse = z.infer<typeof createBookingResponseSchema>
export type GetBookingsQuery = z.infer<typeof getBookingsQuerySchema>
export type GetBookingsResponse = z.infer<typeof getBookingsResponseSchema>
export type BookingListItem = z.infer<typeof bookingListItemSchema>
export type GetBookingResponse = z.infer<typeof getBookingResponseSchema>
export type UpdateBookingRequest = z.infer<typeof updateBookingRequestSchema>
export type UpdateBookingResponse = z.infer<typeof updateBookingResponseSchema>
export type RescheduleBookingRequest = z.infer<typeof rescheduleBookingRequestSchema>
export type CancelBookingRequest = z.infer<typeof cancelBookingRequestSchema>
export type CancelBookingResponse = z.infer<typeof cancelBookingResponseSchema>
export type CheckAvailabilityRequest = z.infer<typeof checkAvailabilityRequestSchema>
export type CheckAvailabilityResponse = z.infer<typeof checkAvailabilityResponseSchema>
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>
export type BookingStatsQuery = z.infer<typeof bookingStatsQuerySchema>
export type BookingStatsResponse = z.infer<typeof bookingStatsResponseSchema>
export type BatchUpdateBookingsRequest = z.infer<typeof batchUpdateBookingsSchema>
export type BatchUpdateBookingsResponse = z.infer<typeof batchUpdateBookingsResponseSchema>

// ===== CUSTOM VALIDATION HELPERS =====

export const BookingValidationHelpers = {
  /**
   * Validate booking time slot doesn't conflict with existing bookings
   */
  validateTimeSlot: z
    .object({
      barberId: uuidSchema,
      dateTime: z.string().datetime(),
      duration: durationSchema,
      excludeBookingId: uuidSchema.optional()
    })
    .refine(async (_data) => {
      // This would be implemented in the API route with actual database queries
      // Check for overlapping bookings
      return true
    }, 'Time slot conflicts with existing booking'),

  /**
   * Validate business hours
   */
  validateBusinessHours: z
    .object({
      barberId: uuidSchema,
      dateTime: z.string().datetime()
    })
    .refine(async (_data) => {
      // This would be implemented in the API route
      // Check barber's business hours
      return true
    }, 'Booking time is outside business hours'),

  /**
   * Validate minimum advance booking time
   */
  validateAdvanceBooking: z
    .string()
    .datetime()
    .refine((dateStr) => {
      const bookingTime = new Date(dateStr)
      const now = new Date()
      const minimumAdvanceMs = 2 * 60 * 60 * 1000 // 2 hours
      return bookingTime.getTime() - now.getTime() >= minimumAdvanceMs
    }, 'Booking must be at least 2 hours in advance'),

  /**
   * Validate cancellation deadline
   */
  validateCancellationDeadline: z
    .string()
    .datetime()
    .refine((dateStr) => {
      const bookingTime = new Date(dateStr)
      const now = new Date()
      const cancellationDeadlineMs = 24 * 60 * 60 * 1000 // 24 hours
      return bookingTime.getTime() - now.getTime() >= cancellationDeadlineMs
    }, 'Cannot cancel booking less than 24 hours in advance'),

  /**
   * Calculate booking end time
   */
  calculateEndTime: (dateTime: string, duration: number): string => {
    const start = new Date(dateTime)
    const end = new Date(start.getTime() + duration * 60 * 1000)
    return end.toISOString()
  },

  /**
   * Calculate cancellation deadline
   */
  calculateCancellationDeadline: (dateTime: string): string => {
    const booking = new Date(dateTime)
    const deadline = new Date(booking.getTime() - 24 * 60 * 60 * 1000)
    return deadline.toISOString()
  },

  /**
   * Check if booking can be modified
   */
  canModifyBooking: (status: BookingStatus, dateTime: string): boolean => {
    const bookingTime = new Date(dateTime)
    const now = new Date()

    // Cannot modify past bookings or completed/canceled bookings
    if (bookingTime <= now || ['completed', 'canceled', 'no_show'].includes(status)) {
      return false
    }

    return true
  }
}