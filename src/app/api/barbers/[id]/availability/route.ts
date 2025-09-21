import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api/base/ApiResponse';
import { BarberRepository } from '@/lib/api/repositories/BarberRepository';
import { BookingService } from '@/lib/api/services/BookingService';
import { UserRepository } from '@/lib/api/repositories/UserRepository';
import { BookingRepository } from '@/lib/api/repositories/BookingRepository';
import { NotificationService } from '@/lib/api/services/NotificationService';
import { CacheManager } from '@/lib/api/base/CacheManager';
import { MetricsCollector } from '@/lib/api/base/MetricsCollector';
import { withValidation } from '@/lib/api/middleware/validationMiddleware';
import { withRateLimit } from '@/lib/api/middleware/rateLimitMiddleware';
import { BarberValidationSchemas } from '@/lib/api/schemas/barberSchemas';
import {
  AvailabilityResponseDTO
} from '@/lib/api/types/api-dtos';
import { NotFoundError, ValidationError } from '@/lib/api/base/ApiError';
import prisma from '@/lib/prisma';

// Initialize services
const cacheManager = new CacheManager();
const metricsCollector = new MetricsCollector();
const userRepository = new UserRepository(prisma);
const bookingRepository = new BookingRepository(prisma);
const barberRepository = new BarberRepository(prisma, cacheManager, metricsCollector);
// Initialize notification service first
const notificationService = new NotificationService(
  userRepository,
  bookingRepository,
  barberRepository,
  cacheManager,
  metricsCollector
);
// Then booking service with notification service
const bookingService = new BookingService(
  bookingRepository,
  barberRepository,
  userRepository,
  cacheManager,
  metricsCollector,
  notificationService
);

async function getAvailabilityHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const barberId = params.id;
    const { searchParams } = new URL(request.url);

    if (!barberId) {
      throw new ValidationError('Barber ID is required');
    }

    // Parse query parameters
    const serviceId = searchParams.get('serviceId');
    const date = searchParams.get('date');
    const preferredTime = searchParams.get('preferredTime') || undefined;

    if (!serviceId) {
      throw new ValidationError('Service ID is required');
    }

    if (!date) {
      throw new ValidationError('Date is required (format: YYYY-MM-DD)');
    }

    // Validate date format
    const requestDate = new Date(date);
    if (isNaN(requestDate.getTime())) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
    }

    // Check if date is in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (requestDate < today) {
      throw new ValidationError('Cannot check availability for past dates');
    }

    // Verify barber exists
    const barber = await barberRepository.findById(barberId);
    if (!barber) {
      throw new NotFoundError('Barber not found');
    }

    // Get service details
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        barberId: barberId,
        isActive: true
      }
    });

    if (!service) {
      throw new NotFoundError('Service not found or not available');
    }

    // Get availability using BookingService
    const availability = await bookingService.getAvailability({
      barberId,
      serviceId,
      preferredDate: requestDate,
      preferredTime,
      duration: service.duration
    });

    // Get business hours for the date
    const dayOfWeek = requestDate.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];
    const businessHours = barber.businessHours as any;
    const daySchedule = businessHours?.[dayName as keyof typeof businessHours];

    // Format response
    const responseData: AvailabilityResponseDTO = {
      date: date,
      timeSlots: availability.map(slot => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        available: slot.available,
        price: slot.price || service.price,
        duration: service.duration
      })),
      metadata: {
        barberId,
        serviceId,
        businessHours: {
          isOpen: daySchedule?.isOpen || false,
          start: daySchedule?.start,
          end: daySchedule?.end
        }
      }
    };

    return ApiResponse.success(
      responseData,
      `Availability retrieved for ${barber.businessName} on ${date}`
    );

  } catch (error) {
    throw error;
  }
}

// Apply middleware chain
const handler = withRateLimit({
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `get_availability:${ip}`;
  }
})(
  withValidation(BarberValidationSchemas.getAvailability, {
    validateResponse: true,
    skipBodyValidation: true // GET request uses query params
  })(getAvailabilityHandler)
);

export { handler as GET };