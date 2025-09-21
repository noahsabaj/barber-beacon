import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api/base/ApiResponse';
import { BookingService } from '@/lib/api/services/BookingService';
import { UserRepository } from '@/lib/api/repositories/UserRepository';
import { BookingRepository } from '@/lib/api/repositories/BookingRepository';
import { BarberRepository } from '@/lib/api/repositories/BarberRepository';
import { NotificationService } from '@/lib/api/services/NotificationService';
import { CacheManager } from '@/lib/api/base/CacheManager';
import { MetricsCollector } from '@/lib/api/base/MetricsCollector';
import { withValidation } from '@/lib/api/middleware/validationMiddleware';
import { withRateLimit } from '@/lib/api/middleware/rateLimitMiddleware';
import { BookingValidationSchemas } from '@/lib/api/schemas/bookingSchemas';
import {
  CreateBookingRequestDTO,
  BookingResponseDTO,
  BookingSearchRequestDTO,
  BookingSearchResponseDTO
} from '@/lib/api/types/api-dtos';
import { AuthenticationError, NotFoundError } from '@/lib/api/base/ApiError';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';

// Initialize services
const cacheManager = new CacheManager();
const metricsCollector = new MetricsCollector();
const userRepository = new UserRepository(prisma);
const bookingRepository = new BookingRepository(prisma);
const barberRepository = new BarberRepository(prisma, cacheManager, metricsCollector);
const notificationService = new NotificationService(
  userRepository,
  bookingRepository,
  barberRepository,
  cacheManager,
  metricsCollector
);
const bookingService = new BookingService(
  bookingRepository,
  barberRepository,
  userRepository,
  cacheManager,
  metricsCollector,
  notificationService
);

async function createBookingHandler(request: NextRequest): Promise<Response> {
  try {
    // Extract and verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No valid authorization token provided');
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }

    const userId = decoded.userId || decoded.id;
    const body = await request.json() as CreateBookingRequestDTO;

    // Create booking using BookingService
    const booking = await bookingService.createBooking({
      userId,
      barberId: body.barberId,
      serviceId: body.serviceId,
      scheduledTime: new Date(body.scheduledTime),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.paymentMethodId !== undefined && { paymentMethodId: body.paymentMethodId }),
      ...(body.reminderPreferences !== undefined && { reminderPreferences: body.reminderPreferences })
    } as any);

    // Format response - build object first without type annotation
    const responseData = {
      id: booking.id,
      scheduledTime: booking.scheduledTime.toISOString(),
      duration: booking.duration,
      totalPrice: booking.totalPrice,
      status: booking.status,
      ...(booking.notes && { notes: booking.notes }),
      ...(booking.cancellationReason && { cancellationReason: booking.cancellationReason }),
      ...(booking.cancelledAt && { cancelledAt: booking.cancelledAt.toISOString() }),
      ...(booking.completedAt && { completedAt: booking.completedAt.toISOString() }),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
      user: {
        id: booking.customer.id,
        firstName: booking.customer.firstName,
        lastName: booking.customer.lastName,
        email: booking.customer.email,
        role: (booking.customer as any).role || 'CUSTOMER',
        isEmailVerified: (booking.customer as any).isEmailVerified || false,
        phoneNumber: (booking.customer as any).phoneNumber || (booking.customer as any).phone,
        createdAt: (booking.customer as any).createdAt instanceof Date ? (booking.customer as any).createdAt : new Date((booking.customer as any).createdAt || new Date())
      },
      barber: {
        id: booking.barber.id,
        businessName: booking.barber.businessName,
        address: booking.barber.address || '',
        city: booking.barber.city || '',
        state: booking.barber.state || '',
        rating: booking.barber.rating,
        reviewCount: booking.barber.reviewCount,
        portfolioImages: booking.barber.portfolioImages || [],
        specialties: booking.barber.specialties || [],
        amenities: (booking.barber as any).amenities || [],
        description: (booking.barber as any).description,
        website: (booking.barber as any).website,
        instagramHandle: (booking.barber as any).instagramHandle,
        phoneNumber: (booking.barber as any).phoneNumber,
        user: {
          firstName: booking.barber.user.firstName,
          lastName: booking.barber.user.lastName
        }
      },
      service: {
        id: booking.service.id,
        name: booking.service.name,
        ...(booking.service.description && { description: booking.service.description }),
        duration: booking.service.duration,
        price: booking.service.price,
        type: booking.service.type,
        category: booking.service.category,
        tags: booking.service.tags,
        ...(booking.service.requirements && { requirements: booking.service.requirements }),
        ...(booking.service.preparation && { preparation: booking.service.preparation }),
        isActive: booking.service.isActive,
        createdAt: booking.service.createdAt.toISOString(),
        updatedAt: booking.service.updatedAt.toISOString()
      },
      ...(booking.payment && {
        payment: {
          ...booking.payment,
          currency: 'USD',
          paymentMethod: 'card'
        }
      }),
      ...(booking.review && { review: booking.review })
    } as unknown as BookingResponseDTO;

    return ApiResponse.success(
      responseData,
      'Booking created successfully. You will receive a confirmation email shortly.',
      201
    );

  } catch (error) {
    throw error;
  }
}

async function getBookingsHandler(request: NextRequest): Promise<Response> {
  try {
    // Extract and verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No valid authorization token provided');
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }

    const userId = decoded.userId || decoded.id;
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const barberId = user.role === 'BARBER' ? await getBarberIdForUser(userId) : null;
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const searchRequest: BookingSearchRequestDTO = {
      ...(user.role === 'CUSTOMER' && { userId }),
      ...(barberId && { barberId }),
      ...(status && { status: status.split(',') as any }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    };

    // Search bookings using BookingService
    const result = await bookingService.searchBookings({
      ...searchRequest,
      startDate: searchRequest.startDate ? new Date(searchRequest.startDate) : undefined,
      endDate: searchRequest.endDate ? new Date(searchRequest.endDate) : undefined
    } as any);

    // Format response
    const responseData: BookingSearchResponseDTO = {
      bookings: result.bookings.map(booking => ({
        id: booking.id,
        scheduledTime: booking.scheduledTime.toISOString(),
        duration: booking.duration,
        totalPrice: booking.totalPrice,
        status: booking.status,
        ...(booking.notes && { notes: booking.notes }),
        ...(booking.cancellationReason && { cancellationReason: booking.cancellationReason }),
        ...(booking.cancelledAt && { cancelledAt: booking.cancelledAt.toISOString() }),
        ...(booking.completedAt && { completedAt: booking.completedAt.toISOString() }),
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        user: {
          ...booking.customer,
          role: (booking.customer as any).role || 'CUSTOMER',
          isEmailVerified: (booking.customer as any).isEmailVerified || false,
          createdAt: (booking.customer as any).createdAt?.toISOString() || new Date().toISOString(),
          phoneNumber: (booking.customer as any).phoneNumber || null
        } as any,
        barber: {
          id: booking.barber.id,
          businessName: booking.barber.businessName,
          address: booking.barber.address || '',
          city: booking.barber.city || '',
          state: booking.barber.state || '',
          rating: booking.barber.rating,
          reviewCount: booking.barber.reviewCount,
          portfolioImages: booking.barber.portfolioImages || [],
          specialties: booking.barber.specialties || [],
          amenities: (booking.barber as any).amenities || [],
          user: {
            firstName: booking.barber.user.firstName,
            lastName: booking.barber.user.lastName
          }
        },
        service: {
          ...booking.service,
          createdAt: booking.service.createdAt.toISOString(),
          updatedAt: booking.service.updatedAt.toISOString()
        },
        ...(booking.payment && {
        payment: {
          ...booking.payment,
          currency: 'USD',
          paymentMethod: 'card'
        }
      }),
        ...(booking.review && { review: booking.review })
      }) as unknown as BookingResponseDTO),
      pagination: {
        ...result.pagination,
        hasNextPage: result.pagination.page < result.pagination.totalPages,
        hasPreviousPage: result.pagination.page > 1
      },
      summary: {
        totalBookings: result.bookings.length,
        upcomingBookings: result.bookings.filter(b =>
          new Date(b.scheduledTime) > new Date() && b.status === 'CONFIRMED'
        ).length,
        completedBookings: result.bookings.filter(b => b.status === 'COMPLETED').length,
        totalSpent: result.bookings
          .filter(b => b.status === 'COMPLETED')
          .reduce((sum, b) => sum + b.totalPrice, 0)
      }
    };

    return ApiResponse.success(
      responseData,
      'Bookings retrieved successfully'
    );

  } catch (error) {
    throw error;
  }
}

// Helper function to get barber ID for a user
async function getBarberIdForUser(userId: string): Promise<string | undefined> {
  try {
    const barberProfile = await prisma.barberProfile.findUnique({
      where: { userId }
    });
    return barberProfile?.id;
  } catch {
    return undefined;
  }
}

// Apply middleware chain for POST
const createBookingWithMiddleware = withRateLimit({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        return `create_booking:${decoded.userId || decoded.id}`;
      } catch {
        // Fall back to IP-based rate limiting
      }
    }

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `create_booking:${ip}`;
  }
})(
  withValidation(BookingValidationSchemas.createBooking, {
    validateBody: true,
    validateResponse: true
  })(createBookingHandler)
);

// Apply middleware chain for GET
const getBookingsWithMiddleware = withRateLimit({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        return `get_bookings:${decoded.userId || decoded.id}`;
      } catch {
        // Fall back to IP-based rate limiting
      }
    }

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `get_bookings:${ip}`;
  }
})(getBookingsHandler);

export { createBookingWithMiddleware as POST };
export { getBookingsWithMiddleware as GET };