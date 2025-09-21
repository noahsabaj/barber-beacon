/**
 * User Repository Implementation
 *
 * Extends BaseRepository to provide user-specific data access operations
 * including authentication, role management, profile operations, and
 * user relationship queries.
 *
 * Features:
 * - User authentication and credential management
 * - Role-based user queries (customer, barber, admin)
 * - User profile management with relationships
 * - Email uniqueness validation
 * - User activity tracking and analytics
 * - Barber profile integration
 * - User preference management
 */

import { PrismaClient, User, Prisma, UserRole } from '@prisma/client'
import { BaseRepository, PaginationResult } from './BaseRepository'
import { ConflictError } from '../base/ApiError'

// Type definitions for User operations
export type UserCreateInput = Prisma.UserCreateInput
export type UserUpdateInput = Prisma.UserUpdateInput
export type UserWhereInput = Prisma.UserWhereInput
export type UserWhereUniqueInput = Prisma.UserWhereUniqueInput
export type UserOrderByInput = Prisma.UserOrderByWithRelationInput
export type UserSelectInput = Prisma.UserSelect
export type UserIncludeInput = Prisma.UserInclude

// Extended user types with relationships
export type UserWithBarberProfile = User & {
  barberProfile?: any
}

export type UserWithBookings = User & {
  bookings?: any[]
}

export type UserWithReviews = User & {
  reviews?: any[]
}

export type UserWithRelations = User & {
  barberProfile?: any
  bookings?: any[]
  reviews?: any[]
}

export interface UserSearchFilters {
  email?: string
  role?: UserRole
  firstName?: string
  lastName?: string
  isActive?: boolean
  hasBarberProfile?: boolean
  createdAfter?: Date
  createdBefore?: Date
  lastLoginAfter?: Date
  lastLoginBefore?: Date
}

export interface UserStatistics {
  totalUsers: number
  customerCount: number
  barberCount: number
  adminCount: number
  activeUsers: number
  newUsersThisMonth: number
  usersWithBookings: number
  usersWithReviews: number
  averageBookingsPerUser: number
}

export interface UserActivity {
  userId: string
  lastLogin?: Date
  lastBooking?: Date
  lastReview?: Date
  totalBookings: number
  totalReviews: number
  averageRating?: number
}

/**
 * UserRepository Class
 *
 * Provides specialized data access methods for User entities
 * with support for authentication, role management, and relationships.
 */
export class UserRepository extends BaseRepository<
  User,
  UserCreateInput,
  UserUpdateInput,
  UserWhereInput,
  UserWhereUniqueInput,
  UserOrderByInput,
  UserSelectInput,
  UserIncludeInput
> {
  constructor(prisma: PrismaClient) {
    super(prisma, 'User', {
      cacheEnabled: true,
      defaultCacheTTL: 600 // 10 minutes for user data
    })
  }

  protected getModel() {
    return this.prisma.user
  }

  // ===== AUTHENTICATION METHODS =====

  /**
   * Find user by email for authentication
   */
  async findByEmail(
    email: string,
    options: {
      includePassword?: boolean
      includeBarberProfile?: boolean
    } = {}
  ): Promise<User | null> {
    const select: any = {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      createdAt: true,
      updatedAt: true
    }

    if (options.includePassword) {
      select.password = true
    }

    const include: any = {}
    if (options.includeBarberProfile) {
      include.barberProfile = true
    }

    return this.findFirst({
      where: { email: email.toLowerCase() },
      select: Object.keys(select).length > 0 ? select : undefined,
      include: Object.keys(include).length > 0 ? include : undefined,
      cache: { key: `user:email:${email.toLowerCase()}` }
    })
  }

  /**
   * Check if email exists (for registration validation)
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true }
    })

    return user !== null
  }

  /**
   * Create user with email uniqueness validation
   */
  async createUser(userData: {
    email: string
    password: string
    role?: string
    firstName?: string
    lastName?: string
    phone?: string
    address?: string
  }): Promise<User> {
    // Check email uniqueness
    const existingUser = await this.emailExists(userData.email)
    if (existingUser) {
      throw new ConflictError(`User with email ${userData.email} already exists`)
    }

    // Create user
    const user = await this.create({
      email: userData.email.toLowerCase(),
      password: userData.password,
      role: (userData.role as UserRole) || 'CUSTOMER',
      ...(userData.firstName && { firstName: userData.firstName }),
      ...(userData.lastName && { lastName: userData.lastName }),
      ...(userData.phone && { phone: userData.phone }),
      ...(userData.address && { address: userData.address })
    }, {
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return user
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.update(
      { id: userId },
      { password: newPasswordHash }
    )

    // Invalidate user cache
    await this.invalidateCache([
      this.getCacheKey('findUnique', userId),
      this.getCacheKey('user:email:*')
    ])
  }

  // ===== ROLE-BASED QUERIES =====

  /**
   * Find users by role
   */
  async findByRole(
    role: string,
    options: {
      includeBarberProfile?: boolean
      pagination?: { page: number; limit: number }
      orderBy?: UserOrderByInput
    } = {}
  ): Promise<User[] | PaginationResult<User>> {
    const include: any = {}
    if (options.includeBarberProfile && role === 'BARBER') {
      include.barberProfile = true
    }

    const queryOptions: any = {
      where: { role },
      include: Object.keys(include).length > 0 ? include : undefined,
      orderBy: options.orderBy || { createdAt: 'desc' }
    }

    if (options.pagination) {
      return this.findManyWithPagination({
        ...queryOptions,
        pagination: options.pagination
      })
    }

    return this.findMany(queryOptions)
  }

  /**
   * Get all barbers with their profiles
   */
  async findAllBarbers(
    filters: {
      isActive?: boolean
      hasServices?: boolean
      location?: { lat: number; lng: number; radius: number }
      minRating?: number
    } = {},
    pagination?: { page: number; limit: number }
  ): Promise<PaginationResult<UserWithBarberProfile>> {
    const where: any = {
      role: 'BARBER',
      barberProfile: {
        isNot: null
      }
    }

    // Add additional filters
    if (filters.isActive !== undefined) {
      where.barberProfile.isActive = filters.isActive
    }

    if (filters.hasServices) {
      where.barberProfile.services = {
        some: {}
      }
    }

    if (filters.minRating) {
      where.barberProfile.averageRating = {
        gte: filters.minRating
      }
    }

    const include = {
      barberProfile: {
        include: {
          services: true,
          reviews: {
            select: {
              rating: true
            }
          }
        }
      }
    }

    if (pagination) {
      return this.findManyWithPagination({
        where,
        include,
        pagination,
        orderBy: { createdAt: 'desc' }
      })
    }

    const users = await this.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' }
    })

    return {
      data: users,
      pagination: {
        page: 1,
        limit: users.length,
        total: users.length,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
        offset: 0
      }
    }
  }

  /**
   * Get customer statistics and insights
   */
  async getCustomerInsights(
    customerId: string,
    timeframe?: { start: Date; end: Date }
  ): Promise<{
    user: UserWithRelations
    statistics: {
      totalBookings: number
      completedBookings: number
      canceledBookings: number
      totalSpent: number
      averageBookingValue: number
      favoriteBarbers: any[]
      preferredServices: any[]
    }
  }> {
    const user = await this.findUniqueOrThrow(
      { id: customerId },
      {
        include: {
          bookings: {
            ...(timeframe && {
              where: {
                createdAt: {
                  gte: timeframe.start,
                  lte: timeframe.end
                }
              }
            }),
            include: {
              service: true,
              barber: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              },
              payment: true
            }
          },
          reviews: {
            ...(timeframe && {
              where: {
                createdAt: {
                  gte: timeframe.start,
                  lte: timeframe.end
                }
              }
            }),
            include: {
              booking: {
                include: {
                  barber: true,
                  service: true
                }
              }
            }
          }
        }
      }
    )

    // Calculate statistics
    const bookings = (user as any).bookings || []
    const completedBookings = bookings.filter((b: any) => b.status === 'completed')
    const canceledBookings = bookings.filter((b: any) => b.status === 'canceled')
    const totalSpent = completedBookings.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0)

    // Get favorite barbers (most booked)
    const barberBookingCounts = completedBookings.reduce((acc: any, booking: any) => {
      const barberId = booking.barberId
      acc[barberId] = (acc[barberId] || 0) + 1
      return acc
    }, {})

    const favoriteBarbers = Object.entries(barberBookingCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([barberId, count]) => {
        const booking = bookings.find((b: any) => b.barberId === barberId)
        return {
          barberId,
          bookingCount: count,
          barberName: `${booking?.barber?.user?.firstName} ${booking?.barber?.user?.lastName}`.trim()
        }
      })

    // Get preferred services (most used)
    const serviceBookingCounts = completedBookings.reduce((acc: any, booking: any) => {
      const serviceId = booking.serviceId
      acc[serviceId] = (acc[serviceId] || 0) + 1
      return acc
    }, {})

    const preferredServices = Object.entries(serviceBookingCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([serviceId, count]) => {
        const booking = bookings.find((b: any) => b.serviceId === serviceId)
        return {
          serviceId,
          bookingCount: count,
          serviceName: booking?.service?.name,
          serviceCategory: booking?.service?.category
        }
      })

    return {
      user,
      statistics: {
        totalBookings: bookings.length,
        completedBookings: completedBookings.length,
        canceledBookings: canceledBookings.length,
        totalSpent,
        averageBookingValue: completedBookings.length > 0 ? totalSpent / completedBookings.length : 0,
        favoriteBarbers,
        preferredServices
      }
    }
  }

  // ===== SEARCH AND FILTERING =====

  /**
   * Search users with advanced filtering
   */
  async searchUsers(
    filters: UserSearchFilters,
    pagination: { page: number; limit: number },
    orderBy?: UserOrderByInput
  ): Promise<PaginationResult<UserWithRelations>> {
    const where = this.buildUserWhereClause(filters)

    return this.findManyWithPagination({
      where,
      include: {
        barberProfile: true,
        _count: {
          select: {
            bookings: true,
            reviews: true
          }
        }
      },
      pagination,
      orderBy: orderBy || { createdAt: 'desc' }
    })
  }

  /**
   * Build complex where clause for user searches
   */
  private buildUserWhereClause(filters: UserSearchFilters): UserWhereInput {
    const where: UserWhereInput = {}

    if (filters.email) {
      where.email = {
        contains: filters.email,
        mode: 'insensitive'
      }
    }

    if (filters.role) {
      where.role = filters.role as UserRole
    }

    if (filters.firstName) {
      where.firstName = {
        contains: filters.firstName,
        mode: 'insensitive'
      }
    }

    if (filters.lastName) {
      where.lastName = {
        contains: filters.lastName,
        mode: 'insensitive'
      }
    }

    if (filters.hasBarberProfile !== undefined) {
      if (filters.hasBarberProfile) {
        where.barberProfile = { isNot: null }
      } else {
        where.barberProfile = null
      }
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {}
      if (filters.createdAfter) {
        where.createdAt.gte = filters.createdAfter
      }
      if (filters.createdBefore) {
        where.createdAt.lte = filters.createdBefore
      }
    }

    return where
  }

  // ===== ANALYTICS AND REPORTING =====

  /**
   * Get comprehensive user statistics
   */
  async getUserStatistics(): Promise<UserStatistics> {
    const [
      totalUsers,
      roleStats,
      newUsersThisMonth,
      usersWithBookings,
      usersWithReviews,
      bookingStats
    ] = await Promise.all([
      this.count(),
      this.getUserRoleStatistics(),
      this.getNewUsersCount(30), // Last 30 days
      this.getUsersWithBookingsCount(),
      this.getUsersWithReviewsCount(),
      this.getAverageBookingsPerUser()
    ])

    return {
      totalUsers,
      customerCount: roleStats['CUSTOMER'] || 0,
      barberCount: roleStats['BARBER'] || 0,
      adminCount: roleStats['ADMIN'] || 0,
      activeUsers: totalUsers, // TODO: Implement active user tracking
      newUsersThisMonth,
      usersWithBookings,
      usersWithReviews,
      averageBookingsPerUser: bookingStats
    }
  }

  /**
   * Get user role distribution
   */
  private async getUserRoleStatistics(): Promise<Record<string, number>> {
    // This would use a raw query in a real implementation
    const users = await this.findMany({
      select: { role: true }
    })

    return users.reduce((acc: Record<string, number>, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1
      return acc
    }, {})
  }

  /**
   * Get count of new users in last N days
   */
  private async getNewUsersCount(days: number): Promise<number> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    return this.count({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    })
  }

  /**
   * Get count of users who have made bookings
   */
  private async getUsersWithBookingsCount(): Promise<number> {
    return this.count({
      where: {
        bookings: {
          some: {}
        }
      }
    })
  }

  /**
   * Get count of users who have written reviews
   */
  private async getUsersWithReviewsCount(): Promise<number> {
    return this.count({
      where: {
        reviews: {
          some: {}
        }
      }
    })
  }

  /**
   * Calculate average bookings per user
   */
  private async getAverageBookingsPerUser(): Promise<number> {
    // This would use aggregation in a real implementation
    const totalUsers = await this.count()
    const totalBookings = await this.prisma.booking.count()

    return totalUsers > 0 ? totalBookings / totalUsers : 0
  }

  // ===== USER MANAGEMENT =====

  /**
   * Soft delete user (mark as inactive)
   */
  async deactivateUser(userId: string): Promise<User> {
    // Note: This assumes you have an isActive field, which should be added to the schema
    return this.update(
      { id: userId },
      {
        // isActive: false,
        updatedAt: new Date()
      }
    )
  }

  /**
   * Update user profile information
   */
  async updateProfile(
    userId: string,
    profileData: {
      firstName?: string
      lastName?: string
      phone?: string
      address?: string
    }
  ): Promise<User> {
    return this.update(
      { id: userId },
      {
        ...profileData,
        updatedAt: new Date()
      },
      {
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          phone: true,
          address: true,
          createdAt: true,
          updatedAt: true
        }
      }
    )
  }

  /**
   * Find user by ID (alias for findUnique)
   */
  async findById(userId: string, options?: {
    includeBarberProfile?: boolean
    includePassword?: boolean
  }): Promise<User | null> {
    const include: any = {}
    if (options?.includeBarberProfile) {
      include.barberProfile = true
    }

    const select: any = {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      phone: true,
      address: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true
    }

    if (options?.includePassword) {
      select.password = true
    }

    return this.findUnique(
      { id: userId },
      {
        select: Object.keys(select).length > 0 ? select : undefined,
        include: Object.keys(include).length > 0 ? include : undefined,
        cache: { key: `user:id:${userId}` }
      }
    )
  }

  /**
   * Update user by ID (alias for update)
   */
  async updateById(userId: string, data: UserUpdateInput): Promise<User> {
    return this.update({ id: userId }, data)
  }

  /**
   * Get user activity summary
   */
  async getUserActivity(userId: string): Promise<UserActivity> {
    const user = await this.findUniqueOrThrow(
      { id: userId },
      {
        include: {
          bookings: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true }
          },
          reviews: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true, rating: true }
          },
          _count: {
            select: {
              bookings: true,
              reviews: true
            }
          }
        }
      }
    )

    const lastBooking = (user as any).bookings?.[0]?.createdAt
    const lastReview = (user as any).reviews?.[0]?.createdAt

    // Calculate average rating given by user
    const allReviews = await this.prisma.review.findMany({
      where: { customerId: userId },
      select: { rating: true }
    })

    const averageRating = allReviews.length > 0
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
      : undefined

    return {
      userId,
      lastBooking,
      lastReview,
      totalBookings: (user as any)._count?.bookings || 0,
      totalReviews: (user as any)._count?.reviews || 0,
      ...(averageRating !== undefined && { averageRating })
    }
  }
}