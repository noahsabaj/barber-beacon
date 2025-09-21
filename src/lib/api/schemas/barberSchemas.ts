/**
 * Barber API Validation Schemas
 *
 * Comprehensive Zod schemas for all barber-related endpoints.
 * Designed to work with the validation middleware and provide type safety.
 *
 * Features:
 * - Request/response validation for all barber endpoints
 * - Location and geographic search validation
 * - Service management validation
 * - Portfolio and media validation
 * - Business hours and availability validation
 * - Rating and review aggregation validation
 * - Advanced search filtering and sorting
 */

import { z } from 'zod'

// ===== COMMON VALIDATION SCHEMAS =====

export const uuidSchema = z.string().uuid('Invalid UUID format')

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  lng: z.number().min(-180).max(180, 'Longitude must be between -180 and 180')
})

export const distanceSchema = z
  .number()
  .min(0.1, 'Distance must be at least 0.1 miles')
  .max(100, 'Distance cannot exceed 100 miles')

export const priceSchema = z
  .number()
  .min(0, 'Price cannot be negative')
  .max(1000, 'Price cannot exceed $1000')
  .multipleOf(0.01, 'Price must be to the nearest cent')

export const ratingSchema = z
  .number()
  .min(0, 'Rating cannot be negative')
  .max(5, 'Rating cannot exceed 5')

export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s\-\(\)]{10,}$/, 'Invalid phone number format')
  .optional()

export const businessHoursSchema = z.object({
  monday: z.object({
    isOpen: z.boolean(),
    open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
    close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional()
  }),
  tuesday: z.object({
    isOpen: z.boolean(),
    open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
    close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional()
  }),
  wednesday: z.object({
    isOpen: z.boolean(),
    open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
    close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional()
  }),
  thursday: z.object({
    isOpen: z.boolean(),
    open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
    close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional()
  }),
  friday: z.object({
    isOpen: z.boolean(),
    open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
    close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional()
  }),
  saturday: z.object({
    isOpen: z.boolean(),
    open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
    close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional()
  }),
  sunday: z.object({
    isOpen: z.boolean(),
    open: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional(),
    close: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)').optional()
  })
})

export const serviceSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1, 'Service name is required').max(100, 'Service name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  category: z.enum([
    'haircut',
    'beard_trim',
    'shave',
    'hair_styling',
    'hair_coloring',
    'hair_treatment',
    'facial',
    'eyebrow_trim',
    'mustache_trim',
    'head_massage',
    'other'
  ]),
  price: priceSchema,
  duration: z.number().int().min(15, 'Minimum duration is 15 minutes').max(480, 'Maximum duration is 8 hours'),
  isActive: z.boolean().default(true)
})

// ===== BARBER SEARCH SCHEMAS =====

export const searchBarbersQuerySchema = z.object({
  // Location parameters
  location: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*$/, 'Location must be in lat,lng format').optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.1).max(100).default(25),

  // Search filters
  service: z.string().optional(),
  category: serviceSchema.shape.category.optional(),
  minPrice: z.coerce.number().min(0).default(0),
  maxPrice: z.coerce.number().min(0).default(1000),
  minRating: z.coerce.number().min(0).max(5).optional(),
  availability: z.string().datetime().optional(), // Check availability at specific time

  // Sorting and pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['distance', 'rating', 'price', 'reviews', 'newest']).default('distance'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),

  // Search query
  search: z.string().max(100).optional(), // Search by business name, description, etc.

  // Filters
  isAvailableToday: z.boolean().optional(),
  acceptsWalkIns: z.boolean().optional(),
  hasPortfolio: z.boolean().optional(),
  isVerified: z.boolean().optional()
}).refine((data) => {
  // Either location string OR lat/lng coordinates must be provided
  const hasLocation = data.location || (data.latitude !== undefined && data.longitude !== undefined)
  return hasLocation
}, {
  message: 'Either location (lat,lng) or latitude & longitude must be provided',
  path: ['location']
}).refine((data) => {
  return data.minPrice <= data.maxPrice
}, {
  message: 'Minimum price cannot be greater than maximum price',
  path: ['maxPrice']
})

export const barberListItemSchema = z.object({
  id: uuidSchema,
  businessName: z.string().optional(),
  description: z.string().optional(),
  profilePhoto: z.string().url().optional(),
  coverPhoto: z.string().url().optional(),
  location: coordinatesSchema,
  address: z.string().optional(),
  distance: z.number().min(0), // Distance from search location in miles
  phone: phoneSchema,
  website: z.string().url().optional(),

  // Rating and reviews
  averageRating: ratingSchema,
  totalReviews: z.number().int().min(0),

  // Business info
  isActive: z.boolean(),
  isVerified: z.boolean(),
  acceptsWalkIns: z.boolean(),

  // Pricing
  priceRange: z.object({
    min: priceSchema,
    max: priceSchema
  }),

  // Services (preview)
  featuredServices: z.array(serviceSchema).max(3),
  serviceCategories: z.array(z.string()),

  // Availability
  isAvailableToday: z.boolean(),
  nextAvailableSlot: z.string().datetime().optional(),

  // Social proof
  portfolioCount: z.number().int().min(0),
  yearsOfExperience: z.number().int().min(0).optional(),

  // Contact info
  contact: z.object({
    firstName: z.string(),
    lastName: z.string(),
    phone: phoneSchema
  }),

  // Business hours (condensed)
  isOpenNow: z.boolean(),
  todaysHours: z.object({
    isOpen: z.boolean(),
    open: z.string().optional(),
    close: z.string().optional()
  }).optional()
})

export const searchBarbersResponseSchema = z.object({
  barbers: z.array(barberListItemSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNext: z.boolean(),
    hasPrev: z.boolean()
  }),
  searchCriteria: z.object({
    location: coordinatesSchema.optional(),
    radius: z.number(),
    filters: z.record(z.string(), z.unknown())
  }),
  aggregations: z.object({
    averagePrice: z.number().min(0),
    averageRating: ratingSchema,
    serviceCategories: z.array(z.object({
      category: z.string(),
      count: z.number().int().min(0)
    })),
    priceRanges: z.array(z.object({
      range: z.string(),
      count: z.number().int().min(0)
    }))
  }).optional()
})

// ===== GET SINGLE BARBER SCHEMAS =====

export const getBarberParamsSchema = z.object({
  id: uuidSchema
})

export const getBarberQuerySchema = z.object({
  includeServices: z.boolean().default(true),
  includeReviews: z.boolean().default(true),
  includePortfolio: z.boolean().default(true),
  includeAvailability: z.boolean().default(false),
  reviewsLimit: z.coerce.number().int().min(1).max(50).default(10)
})

export const portfolioItemSchema = z.object({
  id: uuidSchema,
  imageUrl: z.string().url(),
  caption: z.string().max(200).optional(),
  serviceCategory: serviceSchema.shape.category.optional(),
  createdAt: z.string().datetime()
})

export const reviewSchema = z.object({
  id: uuidSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
  serviceId: uuidSchema.optional(),
  serviceName: z.string().optional(),
  customer: z.object({
    firstName: z.string(),
    lastName: z.string(),
    avatar: z.string().url().optional()
  }),
  createdAt: z.string().datetime()
})

export const getBarberResponseSchema = z.object({
  barber: z.object({
    id: uuidSchema,
    businessName: z.string().optional(),
    description: z.string().optional(),
    longDescription: z.string().optional(),
    profilePhoto: z.string().url().optional(),
    coverPhoto: z.string().url().optional(),

    // Location and contact
    address: z.string().optional(),
    location: coordinatesSchema.optional(),
    phone: phoneSchema,
    website: z.string().url().optional(),
    email: z.string().email().optional(),

    // Social media
    socialMedia: z.object({
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      twitter: z.string().optional(),
      tiktok: z.string().optional()
    }).optional(),

    // Business info
    isActive: z.boolean(),
    isVerified: z.boolean(),
    acceptsWalkIns: z.boolean(),
    acceptsAppointments: z.boolean(),
    yearsOfExperience: z.number().int().min(0).optional(),

    // Ratings and reviews
    averageRating: ratingSchema,
    totalReviews: z.number().int().min(0),
    ratingBreakdown: z.object({
      5: z.number().int().min(0),
      4: z.number().int().min(0),
      3: z.number().int().min(0),
      2: z.number().int().min(0),
      1: z.number().int().min(0)
    }),

    // Business hours
    businessHours: businessHoursSchema,
    timezone: z.string().default('America/New_York'),

    // Policies
    cancellationPolicy: z.string().optional(),
    noShowPolicy: z.string().optional(),
    depositRequired: z.boolean().default(false),
    depositAmount: priceSchema.optional(),

    // Payment methods
    paymentMethods: z.array(z.enum(['cash', 'card', 'venmo', 'cashapp', 'zelle'])),

    // Services
    services: z.array(serviceSchema).optional(),
    serviceCategories: z.array(z.string()),

    // Portfolio
    portfolio: z.array(portfolioItemSchema).optional(),
    portfolioCount: z.number().int().min(0),

    // Reviews
    reviews: z.array(reviewSchema).optional(),

    // Statistics
    stats: z.object({
      totalBookings: z.number().int().min(0),
      completedBookings: z.number().int().min(0),
      repeatCustomers: z.number().int().min(0),
      averageResponseTime: z.string().optional() // e.g., "2 hours"
    }).optional(),

    // User info
    user: z.object({
      id: uuidSchema,
      firstName: z.string(),
      lastName: z.string(),
      phone: phoneSchema,
      createdAt: z.string().datetime()
    }),

    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
  })
})

// ===== UPDATE BARBER PROFILE SCHEMAS =====

export const updateBarberProfileSchema = z.object({
  businessName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  longDescription: z.string().max(2000).optional(),
  profilePhoto: z.string().url().optional(),
  coverPhoto: z.string().url().optional(),

  // Location and contact
  address: z.string().max(200).optional(),
  location: coordinatesSchema.optional(),
  phone: phoneSchema,
  website: z.string().url().optional(),
  email: z.string().email().optional(),

  // Social media
  socialMedia: z.object({
    instagram: z.string().max(100).optional(),
    facebook: z.string().max(100).optional(),
    twitter: z.string().max(100).optional(),
    tiktok: z.string().max(100).optional()
  }).optional(),

  // Business settings
  acceptsWalkIns: z.boolean().optional(),
  acceptsAppointments: z.boolean().optional(),
  yearsOfExperience: z.number().int().min(0).max(50).optional(),

  // Business hours
  businessHours: businessHoursSchema.optional(),
  timezone: z.string().optional(),

  // Policies
  cancellationPolicy: z.string().max(1000).optional(),
  noShowPolicy: z.string().max(1000).optional(),
  depositRequired: z.boolean().optional(),
  depositAmount: priceSchema.optional(),

  // Payment methods
  paymentMethods: z.array(z.enum(['cash', 'card', 'venmo', 'cashapp', 'zelle'])).optional()
})

// ===== SERVICE MANAGEMENT SCHEMAS =====

export const createServiceSchema = serviceSchema.omit({ id: true })

export const updateServiceSchema = serviceSchema.partial().required({ id: true })

export const serviceResponseSchema = z.object({
  service: serviceSchema.required({ id: true }),
  bookingCount: z.number().int().min(0).optional(),
  revenue: z.number().min(0).optional(),
  averageRating: ratingSchema.optional()
})

export const servicesListResponseSchema = z.object({
  services: z.array(serviceResponseSchema),
  categories: z.array(z.object({
    category: serviceSchema.shape.category,
    count: z.number().int().min(0),
    averagePrice: z.number().min(0)
  }))
})

// ===== PORTFOLIO MANAGEMENT SCHEMAS =====

export const uploadPortfolioItemSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
  caption: z.string().max(200).optional(),
  serviceCategory: serviceSchema.shape.category.optional()
})

export const portfolioResponseSchema = z.object({
  portfolio: z.array(portfolioItemSchema),
  totalCount: z.number().int().min(0),
  categoryCounts: z.record(z.string(), z.number().int().min(0))
})

// ===== AVAILABILITY SCHEMAS =====

export const availabilitySlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  isAvailable: z.boolean(),
  isBlocked: z.boolean().default(false),
  blockReason: z.string().max(100).optional(),
  maxBookings: z.number().int().min(1).default(1)
})

export const getAvailabilityQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: uuidSchema.optional()
}).refine((data) => {
  return new Date(data.startDate) <= new Date(data.endDate)
}, {
  message: 'Start date must be before or equal to end date',
  path: ['endDate']
})

export const availabilityResponseSchema = z.object({
  availability: z.array(availabilitySlotSchema),
  businessHours: businessHoursSchema,
  blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  holidays: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string()
  }))
})

// ===== BARBER STATISTICS SCHEMAS =====

export const barberStatsQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).default('day')
}).refine((data) => {
  return new Date(data.startDate) <= new Date(data.endDate)
}, {
  message: 'Start date must be before or equal to end date',
  path: ['endDate']
})

export const barberStatsResponseSchema = z.object({
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
    newCustomers: z.number().int().min(0),
    repeatCustomers: z.number().int().min(0),
    averageRating: ratingSchema,
    responseRate: z.number().min(0).max(100)
  }),
  chartData: z.array(z.object({
    date: z.string(),
    bookings: z.number().int().min(0),
    revenue: z.number().min(0),
    rating: ratingSchema
  })),
  topServices: z.array(z.object({
    serviceId: uuidSchema,
    serviceName: z.string(),
    bookingCount: z.number().int().min(0),
    revenue: z.number().min(0)
  })),
  customerInsights: z.object({
    totalCustomers: z.number().int().min(0),
    newCustomersRate: z.number().min(0).max(100),
    retentionRate: z.number().min(0).max(100),
    averageCustomerValue: z.number().min(0)
  })
})

// ===== BUSINESS SETTINGS SCHEMAS =====

export const updateBusinessSettingsSchema = z.object({
  bookingSettings: z.object({
    advanceBookingDays: z.number().int().min(1).max(365).default(30),
    minimumNoticeHours: z.number().int().min(1).max(72).default(2),
    allowSameDayBooking: z.boolean().default(true),
    bufferTimeBetweenBookings: z.number().int().min(0).max(60).default(15),
    maxBookingsPerDay: z.number().int().min(1).max(50).default(20)
  }).optional(),

  notificationSettings: z.object({
    emailBookingConfirmation: z.boolean().default(true),
    smsBookingConfirmation: z.boolean().default(true),
    emailBookingReminder: z.boolean().default(true),
    smsBookingReminder: z.boolean().default(true),
    reminderTimeHours: z.number().int().min(1).max(72).default(24)
  }).optional(),

  pricingSettings: z.object({
    currency: z.enum(['USD', 'EUR', 'GBP', 'CAD']).default('USD'),
    taxRate: z.number().min(0).max(50).default(0),
    tipSuggestions: z.array(z.number().int().min(0).max(50)).default([15, 18, 20, 25])
  }).optional()
})

// ===== VALIDATION SCHEMA COLLECTIONS =====

export const BarberValidationSchemas = {
  // Search barbers
  searchBarbers: {
    query: searchBarbersQuerySchema,
    response: searchBarbersResponseSchema
  },

  // Get single barber
  getBarber: {
    params: getBarberParamsSchema,
    query: getBarberQuerySchema,
    response: getBarberResponseSchema
  },

  // Update barber profile
  updateProfile: {
    params: getBarberParamsSchema,
    body: updateBarberProfileSchema,
    response: getBarberResponseSchema
  },

  // Service management
  createService: {
    body: createServiceSchema,
    response: serviceResponseSchema
  },

  updateService: {
    body: updateServiceSchema,
    response: serviceResponseSchema
  },

  getServices: {
    response: servicesListResponseSchema
  },

  // Portfolio management
  uploadPortfolioItem: {
    body: uploadPortfolioItemSchema,
    response: z.object({ portfolioItem: portfolioItemSchema })
  },

  getPortfolio: {
    response: portfolioResponseSchema
  },

  // Availability
  getAvailability: {
    query: getAvailabilityQuerySchema,
    response: availabilityResponseSchema
  },

  updateAvailability: {
    body: z.object({ availability: z.array(availabilitySlotSchema) }),
    response: availabilityResponseSchema
  },

  // Statistics
  getStats: {
    query: barberStatsQuerySchema,
    response: barberStatsResponseSchema
  },

  // Business settings
  updateBusinessSettings: {
    body: updateBusinessSettingsSchema
  }
}

// ===== TYPE EXPORTS =====

export type SearchBarbersQuery = z.infer<typeof searchBarbersQuerySchema>
export type SearchBarbersResponse = z.infer<typeof searchBarbersResponseSchema>
export type BarberListItem = z.infer<typeof barberListItemSchema>
export type GetBarberResponse = z.infer<typeof getBarberResponseSchema>
export type UpdateBarberProfileRequest = z.infer<typeof updateBarberProfileSchema>
export type ServiceSchema = z.infer<typeof serviceSchema>
export type CreateServiceRequest = z.infer<typeof createServiceSchema>
export type UpdateServiceRequest = z.infer<typeof updateServiceSchema>
export type PortfolioItem = z.infer<typeof portfolioItemSchema>
export type UploadPortfolioRequest = z.infer<typeof uploadPortfolioItemSchema>
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>
export type GetAvailabilityQuery = z.infer<typeof getAvailabilityQuerySchema>
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>
export type BarberStatsQuery = z.infer<typeof barberStatsQuerySchema>
export type BarberStatsResponse = z.infer<typeof barberStatsResponseSchema>
export type BusinessHours = z.infer<typeof businessHoursSchema>
export type Review = z.infer<typeof reviewSchema>

// ===== CUSTOM VALIDATION HELPERS =====

export const BarberValidationHelpers = {
  /**
   * Validate business hours consistency
   */
  validateBusinessHours: (hours: BusinessHours): boolean => {
    const days = Object.keys(hours) as (keyof BusinessHours)[]

    for (const day of days) {
      const dayHours = hours[day]
      if (dayHours.isOpen) {
        if (!dayHours.open || !dayHours.close) {
          return false
        }

        const openTime = new Date(`2000-01-01T${dayHours.open}:00`)
        const closeTime = new Date(`2000-01-01T${dayHours.close}:00`)

        if (openTime >= closeTime) {
          return false
        }
      }
    }

    return true
  },

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance: (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 3959 // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  },

  /**
   * Check if barber is currently open
   */
  isBarberOpen: (businessHours: BusinessHours, _timezone: string = 'America/New_York'): boolean => {
    const now = new Date()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const currentDay = dayNames[now.getDay()] as keyof BusinessHours

    const todaysHours = businessHours[currentDay]
    if (!todaysHours.isOpen || !todaysHours.open || !todaysHours.close) {
      return false
    }

    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format
    return currentTime >= todaysHours.open && currentTime <= todaysHours.close
  },

  /**
   * Parse location string to coordinates
   */
  parseLocationString: (location: string): { lat: number; lng: number } | null => {
    const parts = location.split(',')
    if (parts.length !== 2) return null

    const lat = parseFloat(parts[0]?.trim() || '')
    const lng = parseFloat(parts[1]?.trim() || '')

    if (isNaN(lat) || isNaN(lng)) return null
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

    return { lat, lng }
  },

  /**
   * Validate service pricing consistency
   */
  validateServicePricing: (services: ServiceSchema[]): boolean => {
    // Check that services in same category have reasonable price ranges
    const categoryPrices: Record<string, number[]> = {}

    for (const service of services) {
      if (!categoryPrices[service.category]) {
        categoryPrices[service.category] = []
      }
      categoryPrices[service.category]!.push(service.price)
    }

    // Validate that price variations within categories aren't extreme
    for (const [category, prices] of Object.entries(categoryPrices)) {
      if (prices.length > 1) {
        const min = Math.min(...prices)
        const max = Math.max(...prices)

        // Price variation shouldn't be more than 500% within same category
        if (max / min > 5) {
          console.warn(`Large price variation in category ${category}: $${min} - $${max}`)
        }
      }
    }

    return true
  },

  /**
   * Generate availability suggestions
   */
  suggestAvailability: (businessHours: BusinessHours, _serviceDuration: number = 60): AvailabilitySlot[] => {
    const suggestions: AvailabilitySlot[] = []
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

    for (const day of days) {
      const dayHours = businessHours[day as keyof BusinessHours]
      if (dayHours.isOpen && dayHours.open && dayHours.close) {
        const openHour = parseInt(dayHours.open.split(':')[0] || '0')
        const closeHour = parseInt(dayHours.close.split(':')[0] || '0')

        // Generate slots every hour
        for (let hour = openHour; hour < closeHour; hour++) {
          const startTime = `${hour.toString().padStart(2, '0')}:00`
          const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`

          suggestions.push({
            date: '2024-01-01', // Placeholder date
            startTime,
            endTime,
            isAvailable: true,
            isBlocked: false,
            maxBookings: 1
          })
        }
      }
    }

    return suggestions
  }
}