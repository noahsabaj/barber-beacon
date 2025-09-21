/**
 * Booking Repository Implementation
 *
 * Extends BaseRepository to provide booking-specific data access operations
 * including scheduling, availability checking, booking lifecycle management,
 * analytics, and conflict resolution.
 *
 * Features:
 * - Booking scheduling and availability validation
 * - Time conflict detection and resolution
 * - Status-based booking queries and lifecycle management
 * - Payment integration and tracking
 * - Review integration and analytics
 * - Barber and customer booking insights
 * - Revenue and performance analytics
 * - Recurring booking management
 */

import { PrismaClient, Booking, Prisma, BookingStatus } from '@prisma/client'
import { BaseRepository, PaginationResult } from './BaseRepository'
import {
  ConflictError,
  ValidationError,
  BusinessLogicError
} from '../base/ApiError'

// Type definitions for Booking operations
export type BookingCreateInput = Prisma.BookingCreateInput
export type BookingUpdateInput = Prisma.BookingUpdateInput
export type BookingWhereInput = Prisma.BookingWhereInput
export type BookingWhereUniqueInput = Prisma.BookingWhereUniqueInput
export type BookingOrderByInput = Prisma.BookingOrderByWithRelationInput
export type BookingSelectInput = Prisma.BookingSelect
export type BookingIncludeInput = Prisma.BookingInclude

// Extended booking types with relationships
export type BookingWithRelations = Booking & {
  customer?: any
  barber?: any
  service?: any
  payment?: any
  review?: any
}

export type BookingDetails = Prisma.BookingGetPayload<{
  include: {
    customer: {
      select: {
        id: true
        email: true
        firstName: true
        lastName: true
        phone: true
      }
    }
    barber: {
      select: {
        id: true
        businessName: true
        address: true
        city: true
        state: true
        rating: true
        reviewCount: true
        portfolioImages: true
        specialties: true
        user: {
          select: {
            id: true
            email: true
            firstName: true
            lastName: true
          }
        }
      }
    }
    service: true
    payment: true
    review: true
  }
}>

export interface BookingSearchFilters {
  customerId?: string
  barberId?: string
  serviceId?: string
  status?: string
  paymentStatus?: string
  dateFrom?: Date
  dateTo?: Date
  totalAmountMin?: number
  totalAmountMax?: number
  hasReview?: boolean
  hasPayment?: boolean
}

export interface AvailabilityCheck {
  barberId: string
  requestedDateTime: Date
  serviceDuration: number
  excludeBookingId?: string
}

export interface TimeSlot {
  startTime: Date
  endTime: Date
  isAvailable: boolean
  conflictingBookings?: BookingWithRelations[]
  reason?: string
}

export interface BookingConflict {
  conflictingBooking: BookingWithRelations
  overlapMinutes: number
  conflictType: 'complete_overlap' | 'partial_overlap' | 'adjacent'
}

export interface BookingStatistics {
  totalBookings: number
  bookingsByStatus: Record<string, number>
  bookingsByPaymentStatus: Record<string, number>
  totalRevenue: number
  averageBookingValue: number
  completionRate: number
  cancellationRate: number
  noShowRate: number
  averageDuration: number
  popularServices: Array<{
    serviceId: string
    serviceName: string
    bookingCount: number
    revenue: number
  }>
  peakHours: Array<{
    hour: number
    bookingCount: number
  }>
  monthlyTrends: Array<{
    month: string
    bookings: number
    revenue: number
  }>
}

export interface BookingInsights {
  barberId?: string
  customerId?: string
  period: {
    start: Date
    end: Date
  }
  metrics: {
    totalBookings: number
    completedBookings: number
    revenue: number
    averageRating?: number
    repeatBookingRate?: number
    averageTimeBetweenBookings?: number
  }
  trends: {
    bookingsGrowth: number
    revenueGrowth: number
    ratingTrend: number
  }
}

/**
 * BookingRepository Class
 *
 * Provides specialized data access methods for Booking entities
 * with support for scheduling, availability, and analytics.
 */
export class BookingRepository extends BaseRepository<
  Booking,
  BookingCreateInput,
  BookingUpdateInput,
  BookingWhereInput,
  BookingWhereUniqueInput,
  BookingOrderByInput,
  BookingSelectInput,
  BookingIncludeInput
> {
  constructor(prisma: PrismaClient) {
    super(prisma, 'Booking', {
      cacheEnabled: true,
      defaultCacheTTL: 300 // 5 minutes for booking data
    })
  }

  protected getModel() {
    return this.prisma.booking
  }

  /**
   * Find booking with all related details
   */
  async findBookingWithDetails(bookingId: string): Promise<BookingDetails | null> {
    return this.findUnique(
      { id: bookingId },
      {
        include: {
          customer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              phoneNumber: true,
              role: true,
              isEmailVerified: true,
              createdAt: true
            }
          },
          barber: {
            select: {
              id: true,
              businessName: true,
              address: true,
              city: true,
              state: true,
              rating: true,
              reviewCount: true,
              portfolioImages: true,
              specialties: true,
              amenities: true,
              description: true,
              website: true,
              instagramHandle: true,
              phoneNumber: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          service: true,
          payment: true,
          review: true
        },
        cache: { key: `booking:details:${bookingId}` }
      }
    ) as any
  }

  // ===== SCHEDULING AND AVAILABILITY =====

  /**
   * Check if a time slot is available for booking
   */
  async checkAvailability(check: AvailabilityCheck): Promise<{
    isAvailable: boolean
    conflicts: BookingConflict[]
    suggestions?: TimeSlot[]
  }> {
    const { barberId, requestedDateTime, serviceDuration, excludeBookingId } = check

    const startTime = new Date(requestedDateTime)
    const endTime = new Date(startTime.getTime() + serviceDuration * 60000)

    // Find conflicting bookings
    const conflictingBookings = await this.findMany({
      where: {
        barberId,
        status: {
          not: 'CANCELLED'
        },
        ...(excludeBookingId && { id: { not: excludeBookingId } }),
        OR: [
          // Booking starts during requested time
          {
            scheduledTime: {
              gte: startTime,
              lt: endTime
            }
          },
          // Booking ends during requested time
          {
            AND: [
              {
                scheduledTime: {
                  lt: startTime
                }
              },
              // Need to calculate end time based on service duration
              // This is a simplified check - in practice you'd need the service duration
            ]
          },
          // Booking completely encompasses requested time
          {
            AND: [
              {
                scheduledTime: {
                  lte: startTime
                }
              }
              // Again, would need service duration calculation
            ]
          }
        ]
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        service: {
          select: {
            name: true,
            duration: true
          }
        }
      }
    })

    const conflicts: BookingConflict[] = conflictingBookings.map(booking => {
      const bookingEndTime = new Date(booking.scheduledTime.getTime() + ((booking as any).service?.duration || 60) * 60000)

      // Calculate overlap
      const overlapStart = new Date(Math.max(startTime.getTime(), booking.scheduledTime.getTime()))
      const overlapEnd = new Date(Math.min(endTime.getTime(), bookingEndTime.getTime()))
      const overlapMinutes = Math.max(0, (overlapEnd.getTime() - overlapStart.getTime()) / 60000)

      let conflictType: 'complete_overlap' | 'partial_overlap' | 'adjacent'
      if (overlapMinutes === serviceDuration) {
        conflictType = 'complete_overlap'
      } else if (overlapMinutes > 0) {
        conflictType = 'partial_overlap'
      } else {
        conflictType = 'adjacent'
      }

      return {
        conflictingBooking: booking,
        overlapMinutes,
        conflictType
      }
    })

    const isAvailable = conflicts.length === 0

    // Generate alternative time suggestions if not available
    let suggestions: TimeSlot[] = []
    if (!isAvailable) {
      suggestions = await this.generateTimeSlotSuggestions(barberId, requestedDateTime, serviceDuration)
    }

    return {
      isAvailable,
      conflicts,
      suggestions
    }
  }

  /**
   * Generate alternative time slot suggestions
   */
  private async generateTimeSlotSuggestions(
    barberId: string,
    requestedDateTime: Date,
    serviceDuration: number
  ): Promise<TimeSlot[]> {
    const suggestions: TimeSlot[] = []
    const requestedDate = new Date(requestedDateTime)
    requestedDate.setHours(0, 0, 0, 0)

    // Check slots throughout the day (9 AM to 6 PM)
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) { // 30-minute intervals
        const slotStart = new Date(requestedDate)
        slotStart.setHours(hour, minute, 0, 0)

        const availability = await this.checkAvailability({
          barberId,
          requestedDateTime: slotStart,
          serviceDuration
        })

        suggestions.push({
          startTime: slotStart,
          endTime: new Date(slotStart.getTime() + serviceDuration * 60000),
          isAvailable: availability.isAvailable,
          conflictingBookings: availability.conflicts.map(c => c.conflictingBooking),
          ...(!availability.isAvailable && { reason: 'Time slot unavailable' })
        })

        // Stop after finding 5 available slots
        if (availability.isAvailable && suggestions.filter(s => s.isAvailable).length >= 5) {
          break
        }
      }
    }

    return suggestions.filter(s => s.isAvailable).slice(0, 5)
  }

  /**
   * Create booking with availability validation
   */
  async createBookingWithValidation(bookingData: {
    customerId: string
    barberId: string
    serviceId: string
    scheduledTime: Date
    totalAmount: number
    serviceDuration: number
  }): Promise<BookingWithRelations> {
    // Check availability first
    const availability = await this.checkAvailability({
      barberId: bookingData.barberId,
      requestedDateTime: bookingData.scheduledTime,
      serviceDuration: bookingData.serviceDuration
    })

    if (!availability.isAvailable) {
      throw new ConflictError('Time slot is not available', {
        details: [
          {
            field: 'scheduledTime',
            message: 'Selected time slot conflicts with existing booking',
            value: bookingData.scheduledTime
          }
        ],
        metadata: {
          conflicts: availability.conflicts,
          suggestions: availability.suggestions
        }
      })
    }

    // Validate business hours
    await this.validateBusinessHours(bookingData.barberId, bookingData.scheduledTime)

    // Create the booking
    return this.create({
      userId: bookingData.customerId,
      customer: { connect: { id: bookingData.customerId } },
      barber: { connect: { id: bookingData.barberId } },
      service: { connect: { id: bookingData.serviceId } },
      scheduledTime: bookingData.scheduledTime,
      duration: bookingData.serviceDuration || 60, // Default to 60 minutes
      totalPrice: bookingData.totalAmount,
      totalAmount: bookingData.totalAmount,
      status: 'PENDING_CONFIRMATION' as const,
      paymentStatus: 'PENDING'
    }, {
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        barber: {
          select: {
            businessName: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        service: {
          select: {
            name: true,
            duration: true,
            category: true
          }
        }
      }
    })
  }

  /**
   * Validate booking is within business hours
   */
  private async validateBusinessHours(_barberId: string, scheduledTime: Date): Promise<void> {
    // This would check the barber's business hours from their profile
    // For now, simple validation for 9 AM - 6 PM, Monday-Saturday
    const hour = scheduledTime.getHours()
    const day = scheduledTime.getDay()

    if (day === 0) { // Sunday
      throw new ValidationError('Bookings are not available on Sundays')
    }

    if (hour < 9 || hour >= 18) {
      throw new ValidationError('Bookings are only available between 9 AM and 6 PM')
    }

    // Check if booking is too far in advance (max 60 days)
    const maxAdvanceDays = 60
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays)

    if (scheduledTime > maxDate) {
      throw new ValidationError(`Bookings can only be made up to ${maxAdvanceDays} days in advance`)
    }

    // Check minimum advance notice (2 hours)
    const minAdvanceHours = 2
    const minDate = new Date()
    minDate.setHours(minDate.getHours() + minAdvanceHours)

    if (scheduledTime < minDate) {
      throw new ValidationError(`Bookings must be made at least ${minAdvanceHours} hours in advance`)
    }
  }

  // ===== BOOKING LIFECYCLE MANAGEMENT =====

  /**
   * Update booking status with validation
   */
  async updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    options: {
      userId: string
      userRole: string
      reason?: string
    }
  ): Promise<BookingWithRelations> {
    const booking = await this.findUniqueOrThrow(
      { id: bookingId },
      {
        include: {
          customer: true,
          barber: { include: { user: true } }
        }
      }
    )

    // Validate permissions
    this.validateStatusUpdatePermissions(booking, newStatus, options)

    // Validate status transition
    this.validateStatusTransition(booking.status, newStatus)

    // Additional business logic validation
    if (newStatus === 'CANCELLED') {
      await this.validateCancellation(booking)
    }

    return this.update(
      { id: bookingId },
      {
        status: newStatus as any,
        updatedAt: new Date()
      },
      {
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          barber: {
            select: {
              businessName: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          service: true,
          payment: true
        }
      }
    )
  }

  /**
   * Validate permissions for status updates
   */
  private validateStatusUpdatePermissions(
    booking: BookingWithRelations,
    newStatus: string,
    options: { userId: string; userRole: string }
  ): void {
    const { userId, userRole } = options

    if (userRole === 'admin') {
      return // Admins can update any status
    }

    if (newStatus === 'canceled' && booking.customerId === userId) {
      return // Customers can cancel their own bookings
    }

    if (['completed', 'in_progress'].includes(newStatus) &&
        userRole === 'barber' &&
        booking.barber?.userId === userId) {
      return // Barbers can mark their bookings as completed/in_progress
    }

    throw new ValidationError('Insufficient permissions to update booking status')
  }

  /**
   * Validate status transitions
   */
  private validateStatusTransition(currentStatus: string, newStatus: string): void {
    const validTransitions: Record<string, string[]> = {
      'scheduled': ['confirmed', 'canceled', 'in_progress'],
      'confirmed': ['in_progress', 'canceled', 'completed'],
      'in_progress': ['completed', 'canceled'],
      'completed': [], // Cannot change from completed
      'canceled': [], // Cannot change from canceled
      'no_show': []   // Cannot change from no_show
    }

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new ValidationError(
        `Cannot change booking status from ${currentStatus} to ${newStatus}`
      )
    }
  }

  /**
   * Validate cancellation business rules
   */
  private async validateCancellation(booking: BookingWithRelations): Promise<void> {
    const now = new Date()
    const bookingTime = new Date(booking.scheduledTime)
    const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Cannot cancel past bookings
    if (bookingTime <= now) {
      throw new BusinessLogicError('Cannot cancel past bookings')
    }

    // Check minimum cancellation notice (24 hours)
    if (hoursUntilBooking < 24) {
      throw new BusinessLogicError('Bookings must be canceled at least 24 hours in advance')
    }
  }

  // ===== SEARCH AND FILTERING =====

  /**
   * Search bookings with advanced filtering
   */
  async searchBookings(
    filters: BookingSearchFilters,
    pagination: { page: number; limit: number },
    orderBy?: BookingOrderByInput
  ): Promise<PaginationResult<BookingWithRelations>> {
    const where = this.buildBookingWhereClause(filters)

    return this.findManyWithPagination({
      where,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        barber: {
          select: {
            id: true,
            businessName: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        service: {
          select: {
            name: true,
            duration: true,
            category: true
          }
        },
        payment: {
          select: {
            status: true,
            amount: true,
            stripePaymentId: true
          }
        },
        review: {
          select: {
            rating: true,
            comment: true
          }
        }
      },
      pagination,
      orderBy: orderBy || { scheduledTime: 'desc' as const }
    })
  }

  /**
   * Build complex where clause for booking searches
   */
  private buildBookingWhereClause(filters: BookingSearchFilters): BookingWhereInput {
    const where: BookingWhereInput = {}

    if (filters.customerId) {
      where.customerId = filters.customerId
    }

    if (filters.barberId) {
      where.barberId = filters.barberId
    }

    if (filters.serviceId) {
      where.serviceId = filters.serviceId
    }

    if (filters.status) {
      where.status = filters.status as any
    }

    if (filters.paymentStatus) {
      where.paymentStatus = filters.paymentStatus as any
    }

    if (filters.dateFrom || filters.dateTo) {
      where.scheduledTime = {}
      if (filters.dateFrom) {
        where.scheduledTime.gte = filters.dateFrom
      }
      if (filters.dateTo) {
        where.scheduledTime.lte = filters.dateTo
      }
    }

    if (filters.totalAmountMin !== undefined || filters.totalAmountMax !== undefined) {
      where.totalAmount = {}
      if (filters.totalAmountMin !== undefined) {
        where.totalAmount.gte = filters.totalAmountMin
      }
      if (filters.totalAmountMax !== undefined) {
        where.totalAmount.lte = filters.totalAmountMax
      }
    }

    if (filters.hasReview !== undefined) {
      if (filters.hasReview) {
        where.review = { isNot: null }
      } else {
        where.review = null
      }
    }

    if (filters.hasPayment !== undefined) {
      if (filters.hasPayment) {
        where.payment = { isNot: null }
      } else {
        where.payment = null
      }
    }

    return where
  }

  // ===== ANALYTICS AND REPORTING =====

  /**
   * Get comprehensive booking statistics
   */
  async getBookingStatistics(
    filters: {
      barberId?: string
      customerId?: string
      dateFrom?: Date
      dateTo?: Date
    } = {}
  ): Promise<BookingStatistics> {
    const where = this.buildBookingWhereClause(filters)

    const [
      totalBookings,
      bookings,
      statusStats,
      paymentStats
    ] = await Promise.all([
      this.count({ where }),
      this.findMany({
        where,
        include: {
          service: {
            select: {
              name: true,
              duration: true
            }
          },
          payment: {
            select: {
              amount: true
            }
          }
        }
      }),
      this.getBookingStatusStatistics(where),
      this.getPaymentStatusStatistics(where)
    ])

    const completedBookings = bookings.filter(b => b.status === 'COMPLETED')
    const canceledBookings = bookings.filter(b => b.status === 'CANCELLED')
    const noShowBookings = bookings.filter(b => b.status === 'NO_SHOW')

    const totalRevenue = completedBookings.reduce((sum, b) => sum + ((b as any).payment?.amount || b.totalAmount), 0)
    const averageBookingValue = completedBookings.length > 0 ? totalRevenue / completedBookings.length : 0

    const completionRate = totalBookings > 0 ? (completedBookings.length / totalBookings) * 100 : 0
    const cancellationRate = totalBookings > 0 ? (canceledBookings.length / totalBookings) * 100 : 0
    const noShowRate = totalBookings > 0 ? (noShowBookings.length / totalBookings) * 100 : 0

    const totalDuration = completedBookings.reduce((sum, b) => sum + ((b as any).service?.duration || 0), 0)
    const averageDuration = completedBookings.length > 0 ? totalDuration / completedBookings.length : 0

    // Calculate popular services
    const serviceBookings = bookings.reduce((acc: any, booking) => {
      if (booking.serviceId) {
        if (!acc[booking.serviceId]) {
          acc[booking.serviceId] = {
            serviceId: booking.serviceId,
            serviceName: (booking as any).service?.name || 'Unknown',
            bookingCount: 0,
            revenue: 0
          }
        }
        acc[booking.serviceId].bookingCount++
        if (booking.status === 'COMPLETED') {
          acc[booking.serviceId].revenue += (booking as any).payment?.amount || booking.totalAmount
        }
      }
      return acc
    }, {})

    const popularServices = Object.values(serviceBookings)
      .sort((a: any, b: any) => b.bookingCount - a.bookingCount)
      .slice(0, 10)

    // Calculate peak hours
    const hourBookings = bookings.reduce((acc: Record<number, number>, booking) => {
      const hour = new Date(booking.scheduledTime).getHours()
      acc[hour] = (acc[hour] || 0) + 1
      return acc
    }, {})

    const peakHours = Object.entries(hourBookings)
      .map(([hour, count]) => ({ hour: parseInt(hour), bookingCount: count }))
      .sort((a, b) => b.bookingCount - a.bookingCount)

    // Calculate monthly trends (simplified)
    const monthlyTrends = this.calculateMonthlyTrends(bookings)

    return {
      totalBookings,
      bookingsByStatus: statusStats,
      bookingsByPaymentStatus: paymentStats,
      totalRevenue,
      averageBookingValue,
      completionRate,
      cancellationRate,
      noShowRate,
      averageDuration,
      popularServices: popularServices as any[],
      peakHours,
      monthlyTrends
    }
  }

  /**
   * Get booking status statistics
   */
  private async getBookingStatusStatistics(where: BookingWhereInput): Promise<Record<string, number>> {
    const bookings = await this.findMany({
      where,
      select: { status: true }
    })

    return bookings.reduce((acc: Record<string, number>, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1
      return acc
    }, {})
  }

  /**
   * Get payment status statistics
   */
  private async getPaymentStatusStatistics(where: BookingWhereInput): Promise<Record<string, number>> {
    const bookings = await this.findMany({
      where,
      select: { paymentStatus: true }
    })

    return bookings.reduce((acc: Record<string, number>, booking) => {
      acc[booking.paymentStatus] = (acc[booking.paymentStatus] || 0) + 1
      return acc
    }, {})
  }

  /**
   * Calculate monthly trends
   */
  private calculateMonthlyTrends(bookings: BookingWithRelations[]): Array<{
    month: string
    bookings: number
    revenue: number
  }> {
    const monthlyData = bookings.reduce((acc: Record<string, any>, booking) => {
      const month = new Date(booking.scheduledTime).toISOString().slice(0, 7) // YYYY-MM format

      if (!acc[month]) {
        acc[month] = { month, bookings: 0, revenue: 0 }
      }

      acc[month].bookings++
      if (booking.status === 'COMPLETED') {
        acc[month].revenue += booking.payment?.amount || booking.totalAmount
      }

      return acc
    }, {})

    return Object.values(monthlyData)
      .sort((a: any, b: any) => a.month.localeCompare(b.month))
      .slice(-12) // Last 12 months
  }

  // ===== UTILITY METHODS =====

  /**
   * Get upcoming bookings for a user
   */
  async getUpcomingBookings(
    userId: string,
    userRole: 'customer' | 'barber',
    limit: number = 10
  ): Promise<BookingWithRelations[]> {
    const where: BookingWhereInput = {
      scheduledTime: {
        gte: new Date()
      },
      status: {
        in: ['PENDING_CONFIRMATION', 'CONFIRMED']
      }
    }

    if (userRole === 'customer') {
      where.customerId = userId
    } else {
      // For barbers, find their barber profile ID first
      const barberProfile = await this.prisma.barberProfile.findUnique({
        where: { userId },
        select: { id: true }
      })

      if (barberProfile) {
        where.barberId = barberProfile.id
      }
    }

    return this.findMany({
      where,
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        barber: {
          select: {
            businessName: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        service: {
          select: {
            name: true,
            duration: true
          }
        }
      },
      orderBy: { scheduledTime: 'asc' },
      take: limit
    })
  }

  /**
   * Get booking history for a user
   */
  async getBookingHistory(
    userId: string,
    userRole: 'customer' | 'barber',
    pagination: { page: number; limit: number }
  ): Promise<PaginationResult<BookingWithRelations>> {
    const where: BookingWhereInput = {
      status: {
        in: ['COMPLETED', 'CANCELLED', 'NO_SHOW']
      }
    }

    if (userRole === 'customer') {
      where.customerId = userId
    } else {
      // For barbers, find their barber profile ID first
      const barberProfile = await this.prisma.barberProfile.findUnique({
        where: { userId },
        select: { id: true }
      })

      if (barberProfile) {
        where.barberId = barberProfile.id
      }
    }

    return this.findManyWithPagination({
      where,
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        barber: {
          select: {
            businessName: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        service: true,
        payment: true,
        review: true
      },
      pagination,
      orderBy: { scheduledTime: 'desc' }
    })
  }
}