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
  BookingResponseDTO,
  UpdateBookingRequestDTO,
  CancelBookingRequestDTO,
  ServiceResponseDTO
} from '@/lib/api/types/api-dtos';
import {
  AuthenticationError,
  NotFoundError,
  ValidationError
} from '@/lib/api/base/ApiError';
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

async function getBookingHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
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
    const bookingId = params.id;

    if (!bookingId) {
      throw new ValidationError('Booking ID is required');
    }

    // Get booking details from service
    const booking = await bookingRepository.findBookingWithDetails(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Check authorization
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const hasPermission =
      user.role === 'ADMIN' ||
      booking.userId === userId ||
      (user.role === 'BARBER' && await isUserBarberForBooking(userId, booking.barberId));

    if (!hasPermission) {
      throw new AuthenticationError('Not authorized to view this booking');
    }

    // Format response
    const responseData: BookingResponseDTO = {
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
      service: booking.service && {
        id: booking.service.id,
        // barberId removed as it's not part of ServiceResponseDTO
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
      payment: booking.payment ? {
        id: booking.payment.id,
        amount: booking.payment.amount,
        currency: 'USD', // Default currency
        status: booking.payment.status,
        paymentMethod: (booking.payment as any).paymentMethod || 'card',
        ...((booking.payment as any).refundedAmount && { refundedAmount: (booking.payment as any).refundedAmount }),
        ...((booking.payment as any).refundedAt && { refundedAt: (booking.payment as any).refundedAt.toISOString() }),
        ...((booking.payment as any).failureReason && { failureReason: (booking.payment as any).failureReason }),
        createdAt: booking.payment.createdAt.toISOString(),
        updatedAt: booking.payment.updatedAt.toISOString()
      } : undefined,
      ...(booking.review && {
        review: {
          id: booking.review.id,
          rating: booking.review.rating,
          ...(booking.review.comment && { comment: booking.review.comment }),
          tags: booking.review.tags,
          photos: booking.review.photos || [],
          isVerified: booking.review.isVerified,
          isPublic: booking.review.isPublic,
          ...(booking.review.barberResponse && { barberResponse: booking.review.barberResponse }),
          ...(booking.review.barberResponseAt && { barberResponseAt: booking.review.barberResponseAt.toISOString() }),
          createdAt: booking.review.createdAt.toISOString(),
          updatedAt: booking.review.updatedAt.toISOString(),
          user: {
            firstName: (booking.review as any).customer?.firstName || null,
            lastName: (booking.review as any).customer?.lastName || null
          },
          booking: {
            id: booking.id,
            serviceId: booking.serviceId,
            serviceName: booking.service?.name || 'Service',
            scheduledTime: booking.scheduledTime.toISOString()
          }
        } as any
      })
    };

    return ApiResponse.success(
      responseData,
      'Booking details retrieved successfully'
    );

  } catch (error) {
    throw error;
  }
}

async function updateBookingHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
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
    const bookingId = params.id;
    const body = await request.json() as UpdateBookingRequestDTO;

    if (!bookingId) {
      throw new ValidationError('Booking ID is required');
    }

    // Update booking using BookingService
    const updateParams: any = {
      bookingId,
      userId
    };

    if (body.scheduledTime) {
      updateParams.scheduledTime = new Date(body.scheduledTime);
    }
    if (body.serviceId) {
      updateParams.serviceId = body.serviceId;
    }
    if (body.notes) {
      updateParams.notes = body.notes;
    }
    if (body.status) {
      updateParams.status = body.status;
    }

    const updatedBooking = await bookingService.updateBooking(updateParams);

    // Format response
    const responseData: BookingResponseDTO = {
      id: updatedBooking.id,
      scheduledTime: updatedBooking.scheduledTime.toISOString(),
      duration: updatedBooking.duration,
      totalPrice: updatedBooking.totalPrice,
      status: updatedBooking.status,
      ...(updatedBooking.notes && { notes: updatedBooking.notes }),
      ...(updatedBooking.cancellationReason && { cancellationReason: updatedBooking.cancellationReason }),
      ...(updatedBooking.cancelledAt && { cancelledAt: updatedBooking.cancelledAt.toISOString() }),
      ...(updatedBooking.completedAt && { completedAt: updatedBooking.completedAt.toISOString() }),
      createdAt: updatedBooking.createdAt.toISOString(),
      updatedAt: updatedBooking.updatedAt.toISOString(),
      user: {
        id: updatedBooking.customer.id,
        firstName: updatedBooking.customer.firstName,
        lastName: updatedBooking.customer.lastName,
        email: updatedBooking.customer.email,
        role: (updatedBooking.customer as any).role || 'CUSTOMER',
        isEmailVerified: (updatedBooking.customer as any).isEmailVerified || false,
        phoneNumber: (updatedBooking.customer as any).phoneNumber || (updatedBooking.customer as any).phone,
        createdAt: (updatedBooking.customer as any).createdAt || new Date()
      },
      barber: {
        id: updatedBooking.barber.id,
        businessName: updatedBooking.barber.businessName,
        address: updatedBooking.barber.address || '',
        city: updatedBooking.barber.city || '',
        state: updatedBooking.barber.state || '',
        rating: updatedBooking.barber.rating,
        reviewCount: updatedBooking.barber.reviewCount,
        portfolioImages: updatedBooking.barber.portfolioImages || [],
        specialties: updatedBooking.barber.specialties || [],
        amenities: (updatedBooking.barber as any).amenities || [],
        description: (updatedBooking.barber as any).description,
        website: (updatedBooking.barber as any).website,
        instagramHandle: (updatedBooking.barber as any).instagramHandle,
        phoneNumber: (updatedBooking.barber as any).phoneNumber,
        user: {
          firstName: updatedBooking.barber.user.firstName,
          lastName: updatedBooking.barber.user.lastName
        }
      },
      service: updatedBooking.service ? {
        id: updatedBooking.service.id,
        name: updatedBooking.service.name,
        ...(updatedBooking.service.description && { description: updatedBooking.service.description }),
        duration: updatedBooking.service.duration,
        price: updatedBooking.service.price,
        type: updatedBooking.service.type,
        category: updatedBooking.service.category,
        tags: updatedBooking.service.tags,
        ...(updatedBooking.service.requirements && { requirements: updatedBooking.service.requirements }),
        ...(updatedBooking.service.preparation && { preparation: updatedBooking.service.preparation }),
        isActive: updatedBooking.service.isActive,
        createdAt: updatedBooking.service.createdAt.toISOString(),
        updatedAt: updatedBooking.service.updatedAt.toISOString()
      } as ServiceResponseDTO : {} as ServiceResponseDTO,
      payment: updatedBooking.payment ? {
        id: updatedBooking.payment.id,
        amount: updatedBooking.payment.amount,
        currency: 'USD',
        status: updatedBooking.payment.status,
        paymentMethod: (updatedBooking.payment as any).paymentMethod || 'card',
        ...((updatedBooking.payment as any).refundedAmount && { refundedAmount: (updatedBooking.payment as any).refundedAmount }),
        ...((updatedBooking.payment as any).refundedAt && { refundedAt: (updatedBooking.payment as any).refundedAt.toISOString() }),
        ...((updatedBooking.payment as any).failureReason && { failureReason: (updatedBooking.payment as any).failureReason }),
        createdAt: updatedBooking.payment.createdAt.toISOString(),
        updatedAt: updatedBooking.payment.updatedAt.toISOString()
      } : undefined,
      ...(updatedBooking.review && {
        review: {
          id: updatedBooking.review.id,
          rating: updatedBooking.review.rating,
          ...(updatedBooking.review.comment && { comment: updatedBooking.review.comment }),
          tags: updatedBooking.review.tags,
          photos: updatedBooking.review.photos || [],
          isVerified: updatedBooking.review.isVerified,
          isPublic: updatedBooking.review.isPublic,
          ...(updatedBooking.review.barberResponse && { barberResponse: updatedBooking.review.barberResponse }),
          ...(updatedBooking.review.barberResponseAt && { barberResponseAt: updatedBooking.review.barberResponseAt.toISOString() }),
          createdAt: updatedBooking.review.createdAt.toISOString(),
          updatedAt: updatedBooking.review.updatedAt.toISOString(),
          user: {
            firstName: (updatedBooking.review as any).customer?.firstName || null,
            lastName: (updatedBooking.review as any).customer?.lastName || null
          },
          booking: {
            id: updatedBooking.id,
            serviceId: updatedBooking.serviceId,
            serviceName: updatedBooking.service?.name || 'Service',
            scheduledTime: updatedBooking.scheduledTime.toISOString()
          }
        } as any
      })
    };

    return ApiResponse.success(
      responseData,
      'Booking updated successfully'
    );

  } catch (error) {
    throw error;
  }
}

async function cancelBookingHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
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
    const bookingId = params.id;
    const body = await request.json().catch(() => ({})) as CancelBookingRequestDTO;

    if (!bookingId) {
      throw new ValidationError('Booking ID is required');
    }

    // Cancel booking using BookingService
    await bookingService.cancelBooking(bookingId, userId, body.reason);

    return ApiResponse.success(
      { message: 'Booking cancelled successfully' },
      'Your booking has been cancelled. You will receive a confirmation email shortly.'
    );

  } catch (error) {
    throw error;
  }
}

// Helper function to check if user is barber for booking
async function isUserBarberForBooking(userId: string, barberId: string): Promise<boolean> {
  try {
    const barberProfile = await prisma.barberProfile.findUnique({
      where: { userId }
    });
    return barberProfile?.id === barberId;
  } catch {
    return false;
  }
}

// Apply middleware chain for GET
const getBookingWithMiddleware = withRateLimit({
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        return `get_booking:${decoded.userId || decoded.id}`;
      } catch {
        // Fall back to IP-based rate limiting
      }
    }

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `get_booking:${ip}`;
  }
})(getBookingHandler);

// Apply middleware chain for PUT
const updateBookingWithMiddleware = withRateLimit({
  maxRequests: 20,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        return `update_booking:${decoded.userId || decoded.id}`;
      } catch {
        // Fall back to IP-based rate limiting
      }
    }

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `update_booking:${ip}`;
  }
})(
  withValidation(BookingValidationSchemas.updateBooking, {
    validateBody: true,
    validateResponse: true
  })(updateBookingHandler)
);

// Apply middleware chain for DELETE
const cancelBookingWithMiddleware = withRateLimit({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        return `cancel_booking:${decoded.userId || decoded.id}`;
      } catch {
        // Fall back to IP-based rate limiting
      }
    }

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `cancel_booking:${ip}`;
  }
})(cancelBookingHandler);

export { getBookingWithMiddleware as GET };
export { updateBookingWithMiddleware as PUT };
export { cancelBookingWithMiddleware as DELETE };