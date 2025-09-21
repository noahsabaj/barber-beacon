import { Prisma, BarberProfile, Service, Review, User, Booking } from '@prisma/client';
import { BaseRepository, PaginationResult } from './BaseRepository';
import { CacheManager } from '../base/CacheManager';
import { MetricsCollector } from '../base/MetricsCollector';

// Extended types for barber operations
export type BarberWithServices = BarberProfile & {
  services: Service[];
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'createdAt'>;
};

export type BarberWithReviews = BarberProfile & {
  services: Service[];
  user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'isEmailVerified' | 'phoneNumber' | 'createdAt'>;
  reviews: (Review & {
    user: Pick<User, 'firstName' | 'lastName'>;
    booking: Pick<Booking, 'id' | 'serviceId' | 'scheduledTime'>;
  })[];
  _count: {
    reviews: number;
  };
};

export type BarberAnalytics = {
  barberId: string;
  totalBookings: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
  completionRate: number;
  cancellationRate: number;
  repeatCustomerRate: number;
  averageServiceDuration: number;
  popularServices: Array<{
    serviceId: string;
    serviceName: string;
    bookingCount: number;
    revenue: number;
  }>;
  busyHours: Array<{
    hour: number;
    bookingCount: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    bookings: number;
    revenue: number;
    newCustomers: number;
  }>;
};

// Type for raw SQL query result with flattened user fields
export type BarberSearchResult = BarberProfile & {
  user_id: string;
  user_email: string;
  user_firstName: string;
  user_lastName: string;
  user_createdAt: Date;
  distance: number;
  average_rating: number;
  review_count: number;
};

export interface LocationSearchParams {
  latitude: number;
  longitude: number;
  radiusKm: number;
  serviceTypes?: string[];
  minRating?: number;
  maxPrice?: number;
  availability?: {
    date: Date;
    startTime: string;
    endTime: string;
  };
  sortBy?: 'distance' | 'rating' | 'price' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface AvailabilityParams {
  barberId: string;
  date: Date;
  serviceId?: string;
  duration?: number;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  serviceId?: string;
}

export interface BusinessInsights {
  barberId: string;
  period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  startDate: Date;
  endDate: Date;
  revenue: {
    total: number;
    growth: number;
    breakdown: Array<{
      serviceId: string;
      serviceName: string;
      revenue: number;
      bookings: number;
    }>;
  };
  customers: {
    total: number;
    new: number;
    returning: number;
    retentionRate: number;
  };
  performance: {
    averageRating: number;
    ratingTrend: number;
    completionRate: number;
    responseTime: number;
  };
  capacity: {
    utilizationRate: number;
    peakHours: string[];
    availableSlots: number;
    bookedSlots: number;
  };
}

export class BarberRepository extends BaseRepository<
  BarberProfile,
  Prisma.BarberProfileCreateInput,
  Prisma.BarberProfileUpdateInput,
  Prisma.BarberProfileWhereInput,
  Prisma.BarberProfileWhereUniqueInput,
  Prisma.BarberProfileOrderByWithRelationInput,
  Prisma.BarberProfileSelect,
  Prisma.BarberProfileInclude
> {
  private cacheManager: CacheManager;
  private metricsCollector: MetricsCollector;

  constructor(
    prisma: any,
    cacheManager: CacheManager,
    metricsCollector: MetricsCollector
  ) {
    super(prisma, 'barberProfile');
    this.cacheManager = cacheManager;
    this.metricsCollector = metricsCollector;
  }

  protected getModel() {
    return this.prisma.barberProfile;
  }

  /**
   * Find barber by ID (alias for findUnique)
   */
  async findById(barberId: string, options?: {
    includeServices?: boolean
    includeReviews?: boolean
    includeUser?: boolean
  }): Promise<BarberProfile | null> {
    const include: any = {}

    if (options?.includeServices) {
      include.services = true
    }

    if (options?.includeReviews) {
      include.reviews = {
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }

    if (options?.includeUser) {
      include.user = {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true
        }
      }
    }

    return this.findUnique(
      { id: barberId },
      {
        include: Object.keys(include).length > 0 ? include : undefined,
        cache: { key: `barber:id:${barberId}` }
      }
    )
  }

  /**
   * Update barber by ID (alias for update)
   */
  async updateById(barberId: string, data: Prisma.BarberProfileUpdateInput): Promise<BarberProfile> {
    return this.update({ id: barberId }, data)
  }

  // Location-based search with distance calculation
  async searchByLocation(params: LocationSearchParams): Promise<PaginationResult<BarberWithServices & { distance: number }>> {
    const startTime = Date.now();
    const cacheKey = `barber_search:${JSON.stringify(params)}`;

    try {
      // Check cache first
      const cached = await this.cacheManager.get<PaginationResult<BarberWithServices & { distance: number }>>(cacheKey);
      if (cached) {
        this.metricsCollector.recordCacheHit('barber_search');
        return cached;
      }

      // Build location filter using raw SQL for distance calculation
      const earthRadiusKm = 6371;
      const { latitude, longitude, radiusKm } = params;

      // Complex query with distance calculation and filtering
      const barbers = await this.prisma.$queryRaw<BarberSearchResult[]>`
        SELECT
          bp.*,
          u.id as "user_id",
          u.email as "user_email",
          u."firstName" as "user_firstName",
          u."lastName" as "user_lastName",
          u."createdAt" as "user_createdAt",
          (
            ${earthRadiusKm} * acos(
              cos(radians(${latitude})) *
              cos(radians(bp.latitude)) *
              cos(radians(bp.longitude) - radians(${longitude})) +
              sin(radians(${latitude})) *
              sin(radians(bp.latitude))
            )
          ) AS distance,
          COALESCE(AVG(r.rating), 0) as average_rating,
          COUNT(DISTINCT r.id) as review_count
        FROM "BarberProfile" bp
        INNER JOIN "User" u ON bp."userId" = u.id
        LEFT JOIN "Review" r ON bp.id = r."barberId"
        WHERE bp.latitude IS NOT NULL
          AND bp.longitude IS NOT NULL
          AND bp."isActive" = true
          AND (
            ${earthRadiusKm} * acos(
              cos(radians(${latitude})) *
              cos(radians(bp.latitude)) *
              cos(radians(bp.longitude) - radians(${longitude})) +
              sin(radians(${latitude})) *
              sin(radians(bp.latitude))
            )
          ) <= ${radiusKm}
          ${params.minRating ? Prisma.sql`AND COALESCE(AVG(r.rating), 0) >= ${params.minRating}` : Prisma.empty}
        GROUP BY bp.id, u.id
        ${this.buildLocationOrderBy(params.sortBy, params.sortOrder)}
        LIMIT 50
      `;

      // Fetch services for each barber
      const barberIds = barbers.map(b => b.id);
      const services = await this.prisma.service.findMany({
        where: { barberId: { in: barberIds } },
        ...(params.serviceTypes && {
          where: {
            barberId: { in: barberIds },
            type: { in: params.serviceTypes }
          }
        }),
        ...(params.maxPrice && {
          where: {
            barberId: { in: barberIds },
            price: { lte: params.maxPrice }
          }
        })
      });

      // Group services by barber
      const servicesMap = services.reduce((acc, service) => {
        if (!acc[service.barberId]) acc[service.barberId] = [];
        acc[service.barberId]!.push(service);
        return acc;
      }, {} as Record<string, Service[]>);

      // Combine data
      const result = barbers
        .filter(barber => !params.serviceTypes || (servicesMap[barber.id] && servicesMap[barber.id]!.length > 0))
        .map(barber => ({
          ...barber,
          services: servicesMap[barber.id] || [],
          user: {
            id: barber.user_id,
            email: barber.user_email,
            firstName: barber.user_firstName,
            lastName: barber.user_lastName,
            createdAt: barber.user_createdAt
          }
        }));

      const paginationResult: PaginationResult<BarberWithServices & { distance: number }> = {
        data: result,
        pagination: {
          page: 1,
          limit: 50,
          total: result.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
          offset: 0
        }
      };

      // Cache for 10 minutes
      await this.cacheManager.set(cacheKey, paginationResult, 600);
      this.metricsCollector.recordCacheMiss('barber_search');

      return paginationResult;
    } catch (error) {
      this.metricsCollector.recordError('barber_search_by_location', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('barber_search_by_location', Date.now() - startTime);
    }
  }

  private buildLocationOrderBy(sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc'): Prisma.Sql {
    switch (sortBy) {
      case 'distance':
        return Prisma.sql`ORDER BY distance ${sortOrder === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`}`;
      case 'rating':
        return Prisma.sql`ORDER BY average_rating ${sortOrder === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`}, distance ASC`;
      case 'popularity':
        return Prisma.sql`ORDER BY review_count ${sortOrder === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`}, distance ASC`;
      default:
        return Prisma.sql`ORDER BY distance ASC`;
    }
  }

  // Get barber with full details including reviews and analytics
  async getBarberDetails(barberId: string): Promise<BarberWithReviews | null> {
    const startTime = Date.now();
    const cacheKey = `barber_details:${barberId}`;

    try {
      const cached = await this.cacheManager.get<BarberWithReviews>(cacheKey);
      if (cached) {
        this.metricsCollector.recordCacheHit('barber_details');
        return cached;
      }

      const barber = await this.prisma.barberProfile.findUnique({
        where: { id: barberId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true
            }
          },
          services: true,
          reviews: {
            include: {
              customer: {
                select: {
                  firstName: true,
                  lastName: true
                }
              },
              booking: {
                select: {
                  id: true,
                  serviceId: true
                }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
          },
          _count: {
            select: {
              reviews: true
            }
          }
        }
      });

      if (barber) {
        await this.cacheManager.set(cacheKey, barber, 300); // Cache for 5 minutes
        this.metricsCollector.recordCacheMiss('barber_details');
      }

      return barber as unknown as BarberWithReviews;
    } catch (error) {
      this.metricsCollector.recordError('get_barber_details', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('get_barber_details', Date.now() - startTime);
    }
  }

  // Check availability for specific time slots
  async checkAvailability(params: AvailabilityParams): Promise<TimeSlot[]> {
    const startTime = Date.now();
    const { barberId, date, serviceId, duration = 60 } = params;

    try {
      // Get barber's business hours
      const barber = await this.prisma.barberProfile.findUnique({
        where: { id: barberId },
        select: {
          businessHours: true,
          services: serviceId ? { where: { id: serviceId } } : true
        }
      });

      if (!barber) throw new Error('Barber not found');

      // Get existing bookings for the date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const existingBookings = await this.prisma.booking.findMany({
        where: {
          barberId,
          scheduledTime: {
            gte: startOfDay,
            lte: endOfDay
          },
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] }
        },
        include: {
          service: {
            select: { duration: true }
          }
        }
      });

      // Generate time slots based on business hours
      const dayOfWeek = date.getDay();
      const businessHours = barber.businessHours as any;
      const daySchedule = businessHours[this.getDayName(dayOfWeek)];

      if (!daySchedule || !daySchedule.isOpen) {
        return [];
      }

      const timeSlots: TimeSlot[] = [];
      const [startHour, startMinute] = daySchedule.start.split(':').map(Number);
      const [endHour, endMinute] = daySchedule.end.split(':').map(Number);

      const startTime = new Date(date);
      startTime.setHours(startHour, startMinute, 0, 0);
      const endTime = new Date(date);
      endTime.setHours(endHour, endMinute, 0, 0);

      // Generate 15-minute intervals
      let currentTime = new Date(startTime);
      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + (duration * 60000));

        if (slotEnd <= endTime) {
          const isAvailable = !this.isSlotConflicted(currentTime, slotEnd, existingBookings);

          timeSlots.push({
            start: new Date(currentTime),
            end: new Date(slotEnd),
            available: isAvailable,
            ...(serviceId !== undefined && { serviceId })
          });
        }

        currentTime.setMinutes(currentTime.getMinutes() + 15);
      }

      return timeSlots;
    } catch (error) {
      this.metricsCollector.recordError('check_availability', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('check_availability', Date.now() - startTime);
    }
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[dayOfWeek] || 'sunday';
  }

  private isSlotConflicted(slotStart: Date, slotEnd: Date, existingBookings: any[]): boolean {
    return existingBookings.some(booking => {
      const bookingStart = booking.scheduledTime;
      const bookingEnd = new Date(bookingStart.getTime() + (booking.service.duration * 60000));

      return (slotStart < bookingEnd && slotEnd > bookingStart);
    });
  }

  // Get comprehensive barber analytics
  async getBarberAnalytics(barberId: string, periodDays: number = 30): Promise<BarberAnalytics> {
    const startTime = Date.now();
    const cacheKey = `barber_analytics:${barberId}:${periodDays}`;

    try {
      const cached = await this.cacheManager.get<BarberAnalytics>(cacheKey);
      if (cached) {
        this.metricsCollector.recordCacheHit('barber_analytics');
        return cached;
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));

      // Get basic stats
      const [bookingStats, reviewStats] = await Promise.all([
        this.prisma.booking.aggregate({
          where: {
            barberId,
            createdAt: { gte: startDate }
          },
          _count: true,
          _sum: { totalPrice: true }
        }),
        this.prisma.review.aggregate({
          where: {
            barberId,
            createdAt: { gte: startDate }
          },
          _count: true,
          _avg: { rating: true }
        })
      ]);

      // Get status breakdown
      const statusBreakdown = await this.prisma.booking.groupBy({
        by: ['status'],
        where: {
          barberId,
          createdAt: { gte: startDate }
        },
        _count: true
      });

      // Get popular services
      const popularServices = await this.prisma.booking.groupBy({
        by: ['serviceId'],
        where: {
          barberId,
          createdAt: { gte: startDate },
          status: 'COMPLETED'
        },
        _count: true,
        _sum: { totalPrice: true }
      });

      const serviceDetails = await this.prisma.service.findMany({
        where: {
          id: { in: popularServices.map(s => s.serviceId) }
        },
        select: { id: true, name: true }
      });

      // Get busy hours analysis
      const busyHours = await this.prisma.$queryRaw<Array<{ hour: number; bookingCount: bigint }>>`
        SELECT
          EXTRACT(HOUR FROM "scheduledTime") as hour,
          COUNT(*) as "bookingCount"
        FROM "Booking"
        WHERE "barberId" = ${barberId}
          AND "createdAt" >= ${startDate}
          AND status IN ('CONFIRMED', 'COMPLETED')
        GROUP BY EXTRACT(HOUR FROM "scheduledTime")
        ORDER BY "bookingCount" DESC
      `;

      // Calculate metrics
      const totalBookings = bookingStats._count;
      const completedBookings = statusBreakdown.find(s => s.status === 'COMPLETED')?._count || 0;
      const cancelledBookings = statusBreakdown.find(s => s.status === 'CANCELLED')?._count || 0;

      const analytics: BarberAnalytics = {
        barberId,
        totalBookings,
        totalRevenue: Number(bookingStats._sum.totalPrice || 0),
        averageRating: Number(reviewStats._avg.rating || 0),
        totalReviews: reviewStats._count,
        completionRate: totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
        cancellationRate: totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
        repeatCustomerRate: await this.calculateRepeatCustomerRate(barberId, startDate),
        averageServiceDuration: await this.calculateAverageServiceDuration(barberId),
        popularServices: popularServices.map(ps => {
          const service = serviceDetails.find(s => s.id === ps.serviceId);
          return {
            serviceId: ps.serviceId,
            serviceName: service?.name || 'Unknown Service',
            bookingCount: ps._count,
            revenue: Number(ps._sum.totalPrice || 0)
          };
        }),
        busyHours: busyHours.map(bh => ({
          hour: bh.hour,
          bookingCount: Number(bh.bookingCount)
        })),
        monthlyTrends: await this.getMonthlyTrends(barberId, 6)
      };

      await this.cacheManager.set(cacheKey, analytics, 3600); // Cache for 1 hour
      this.metricsCollector.recordCacheMiss('barber_analytics');

      return analytics;
    } catch (error) {
      this.metricsCollector.recordError('get_barber_analytics', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('get_barber_analytics', Date.now() - startTime);
    }
  }

  private async calculateRepeatCustomerRate(barberId: string, since: Date): Promise<number> {
    const customerBookings = await this.prisma.booking.groupBy({
      by: ['userId'],
      where: {
        barberId,
        createdAt: { gte: since },
        status: 'COMPLETED'
      },
      _count: true
    });

    const repeatCustomers = customerBookings.filter(cb => cb._count > 1).length;
    const totalCustomers = customerBookings.length;

    return totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;
  }

  private async calculateAverageServiceDuration(barberId: string): Promise<number> {
    const services = await this.prisma.service.aggregate({
      where: { barberId },
      _avg: { duration: true }
    });

    return Number(services._avg.duration || 60);
  }

  private async getMonthlyTrends(barberId: string, months: number): Promise<Array<{ month: string; bookings: number; revenue: number; newCustomers: number }>> {
    const trends = [];
    const currentDate = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 0);

      const [bookingStats, newCustomers] = await Promise.all([
        this.prisma.booking.aggregate({
          where: {
            barberId,
            createdAt: { gte: monthStart, lte: monthEnd }
          },
          _count: true,
          _sum: { totalPrice: true }
        }),
        this.prisma.booking.findMany({
          where: {
            barberId,
            createdAt: { gte: monthStart, lte: monthEnd }
          },
          select: { userId: true },
          distinct: ['userId']
        }).then(async (bookings) => {
          const userIds = bookings.map(b => b.userId);
          const firstTimeUsers = await this.prisma.booking.groupBy({
            by: ['userId'],
            where: {
              barberId,
              userId: { in: userIds },
              createdAt: { lt: monthStart }
            },
            _count: true
          });

          return userIds.length - firstTimeUsers.length;
        })
      ]);

      trends.push({
        month: monthStart.toISOString().substring(0, 7),
        bookings: bookingStats._count,
        revenue: Number(bookingStats._sum.totalPrice || 0),
        newCustomers
      });
    }

    return trends;
  }

  // Update barber profile with validation
  async updateBarberProfile(barberId: string, updates: Partial<Prisma.BarberProfileUpdateInput>): Promise<BarberProfile> {
    const startTime = Date.now();

    try {
      return await this.withTransaction(async (ctx) => {
        // Validate business hours if provided
        if (updates.businessHours) {
          this.validateBusinessHours(updates.businessHours as any);
        }

        const updated = await ctx.prisma.barberProfile.update({
          where: { id: barberId },
          data: updates
        });

        // Invalidate related caches
        await this.cacheManager.invalidatePattern(`barber_*:${barberId}`);
        await this.cacheManager.invalidatePattern('barber_search:*');

        this.metricsCollector.recordDatabaseOperation('update_barber_profile', Date.now() - startTime, true);
        return updated;
      });
    } catch (error) {
      this.metricsCollector.recordDatabaseOperation('update_barber_profile', Date.now() - startTime, false);
      this.metricsCollector.recordError('update_barber_profile', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('update_barber_profile', Date.now() - startTime);
    }
  }

  private validateBusinessHours(businessHours: any): void {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (const day of days) {
      if (businessHours[day] && businessHours[day].isOpen) {
        const { start, end } = businessHours[day];

        if (!start || !end) {
          throw new Error(`Invalid business hours for ${day}: start and end times are required`);
        }

        const startTime = new Date(`2000-01-01T${start}:00`);
        const endTime = new Date(`2000-01-01T${end}:00`);

        if (startTime >= endTime) {
          throw new Error(`Invalid business hours for ${day}: start time must be before end time`);
        }
      }
    }
  }

  // Get business insights with advanced analytics
  async getBusinessInsights(barberId: string, period: BusinessInsights['period'], startDate: Date, endDate: Date): Promise<BusinessInsights> {
    const startTime = Date.now();
    const cacheKey = `business_insights:${barberId}:${period}:${startDate.toISOString()}:${endDate.toISOString()}`;

    try {
      const cached = await this.cacheManager.get<BusinessInsights>(cacheKey);
      if (cached) {
        this.metricsCollector.recordCacheHit('business_insights');
        return cached;
      }

      // Get revenue breakdown
      const revenueData = await this.prisma.booking.findMany({
        where: {
          barberId,
          createdAt: { gte: startDate, lte: endDate },
          status: 'COMPLETED'
        },
        include: {
          service: {
            select: { id: true, name: true }
          }
        }
      });

      const revenueBreakdown = revenueData.reduce((acc, booking) => {
        const serviceId = booking.serviceId;
        if (!acc[serviceId]) {
          acc[serviceId] = {
            serviceId,
            serviceName: booking.service.name,
            revenue: 0,
            bookings: 0
          };
        }
        acc[serviceId].revenue += Number(booking.totalPrice);
        acc[serviceId].bookings += 1;
        return acc;
      }, {} as Record<string, any>);

      // Customer analytics
      const allCustomers = await this.prisma.booking.findMany({
        where: {
          barberId,
          createdAt: { gte: startDate, lte: endDate }
        },
        select: { userId: true, createdAt: true },
        distinct: ['userId']
      });

      const returningCustomers = await this.prisma.booking.groupBy({
        by: ['userId'],
        where: {
          barberId,
          createdAt: { gte: startDate, lte: endDate }
        },
        _count: true,
        having: {
          userId: {
            _count: {
              gt: 1
            }
          }
        }
      });

      // Performance metrics
      const reviews = await this.prisma.review.aggregate({
        where: {
          barberId,
          createdAt: { gte: startDate, lte: endDate }
        },
        _avg: { rating: true },
        _count: true
      });

      const totalBookings = revenueData.length;
      const totalRevenue = revenueData.reduce((sum, booking) => sum + Number(booking.totalPrice), 0);

      const insights: BusinessInsights = {
        barberId,
        period,
        startDate,
        endDate,
        revenue: {
          total: totalRevenue,
          growth: 0, // TODO: Calculate compared to previous period
          breakdown: Object.values(revenueBreakdown)
        },
        customers: {
          total: allCustomers.length,
          new: allCustomers.filter(_c => {
            // Check if this is their first booking ever
            return true; // Simplified for now
          }).length,
          returning: returningCustomers.length,
          retentionRate: allCustomers.length > 0 ? (returningCustomers.length / allCustomers.length) * 100 : 0
        },
        performance: {
          averageRating: Number(reviews._avg.rating || 0),
          ratingTrend: 0, // TODO: Calculate trend
          completionRate: 95, // TODO: Calculate actual completion rate
          responseTime: 24 // TODO: Calculate average response time
        },
        capacity: {
          utilizationRate: 75, // TODO: Calculate actual utilization
          peakHours: ['10:00', '14:00', '16:00'], // TODO: Calculate from data
          availableSlots: 0, // TODO: Calculate
          bookedSlots: totalBookings
        }
      };

      await this.cacheManager.set(cacheKey, insights, 1800); // Cache for 30 minutes
      this.metricsCollector.recordCacheMiss('business_insights');

      return insights;
    } catch (error) {
      this.metricsCollector.recordError('get_business_insights', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('get_business_insights', Date.now() - startTime);
    }
  }

  // Bulk operations for performance
  async updateMultipleBarbers(updates: Array<{ id: string; data: Partial<Prisma.BarberProfileUpdateInput> }>): Promise<void> {
    const startTime = Date.now();

    try {
      await this.withTransaction(async (ctx) => {
        const updatePromises = updates.map(({ id, data }) =>
          ctx.prisma.barberProfile.update({
            where: { id },
            data
          })
        );

        await Promise.all(updatePromises);

        // Invalidate caches
        const barberIds = updates.map(u => u.id);
        await Promise.all(
          barberIds.map(id => this.cacheManager.invalidatePattern(`barber_*:${id}`))
        );
        await this.cacheManager.invalidatePattern('barber_search:*');

        this.metricsCollector.recordDatabaseOperation('bulk_update_barbers', Date.now() - startTime, true);
      });
    } catch (error) {
      this.metricsCollector.recordError('update_multiple_barbers', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('update_multiple_barbers', Date.now() - startTime);
    }
  }
}