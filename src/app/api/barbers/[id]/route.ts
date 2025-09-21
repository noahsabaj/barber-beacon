import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api/base/ApiResponse';
import { BarberRepository } from '@/lib/api/repositories/BarberRepository';
import { CacheManager } from '@/lib/api/base/CacheManager';
import { MetricsCollector } from '@/lib/api/base/MetricsCollector';
import { withRateLimit } from '@/lib/api/middleware/rateLimitMiddleware';
import {
  BarberProfileDetailsResponseDTO
} from '@/lib/api/types/api-dtos';
import { NotFoundError, ValidationError } from '@/lib/api/base/ApiError';
import { BusinessHours } from '@/lib/api/types/entities';
import prisma from '@/lib/prisma';

// Initialize services
const cacheManager = new CacheManager();
const metricsCollector = new MetricsCollector();
const barberRepository = new BarberRepository(prisma, cacheManager, metricsCollector);

async function getBarberDetailsHandler(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  try {
    const barberId = params.id;

    if (!barberId) {
      throw new ValidationError('Barber ID is required');
    }

    // Get barber details with all related data
    const barber = await barberRepository.getBarberDetails(barberId);
    if (!barber) {
      throw new NotFoundError('Barber not found');
    }

    // Check if barber is online (simplified logic)
    const isOnline = await checkBarberOnlineStatus(barberId);

    // Get next available slot (simplified)
    const nextAvailableSlot = await getNextAvailableSlot(barberId);

    // Get basic analytics for display
    const analytics = await getBarberDisplayAnalytics(barberId);

    // Format response
    const responseData: BarberProfileDetailsResponseDTO = {
      id: barber.id,
      businessName: barber.businessName,
      ...(barber.description && { description: barber.description }),
      address: barber.address || '',
      city: barber.city || '',
      state: barber.state || '',
      zipCode: barber.zipCode || '',
      phoneNumber: barber.phoneNumber || '',
      ...(barber.website && { website: barber.website }),
      ...(barber.instagramHandle && { instagramHandle: barber.instagramHandle }),
      portfolioImages: barber.portfolioImages || [],
      businessHours: (barber.businessHours as unknown) as BusinessHours,
      ...(barber.latitude && { latitude: barber.latitude }),
      ...(barber.longitude && { longitude: barber.longitude }),
      isActive: barber.isActive,
      rating: barber.rating,
      reviewCount: barber.reviewCount,
      specialties: barber.specialties,
      amenities: barber.amenities,
      createdAt: barber.createdAt.toISOString(),
      updatedAt: barber.updatedAt.toISOString(),
      user: {
        id: barber.user.id,
        firstName: barber.user.firstName,
        lastName: barber.user.lastName,
        email: barber.user.email,
        role: barber.user.role,
        isEmailVerified: barber.user.isEmailVerified,
        phoneNumber: barber.user.phoneNumber,
        createdAt: barber.user.createdAt
      },
      services: barber.services.map(service => ({
        id: service.id,
        name: service.name,
        ...(service.description && { description: service.description }),
        duration: service.duration,
        price: service.price,
        type: service.type,
        category: service.category,
        tags: service.tags,
        ...(service.requirements && { requirements: service.requirements }),
        ...(service.preparation && { preparation: service.preparation }),
        isActive: service.isActive,
        createdAt: service.createdAt.toISOString(),
        updatedAt: service.updatedAt.toISOString()
      })),
      recentReviews: barber.reviews.slice(0, 10).map(review => ({
        id: review.id,
        rating: review.rating,
        ...(review.comment && { comment: review.comment }),
        tags: review.tags,
        photos: review.photos || [],
        isVerified: review.isVerified,
        isPublic: review.isPublic,
        ...(review.barberResponse && { barberResponse: review.barberResponse }),
        ...(review.barberResponseAt && { barberResponseAt: review.barberResponseAt.toISOString() }),
        createdAt: review.createdAt.toISOString(),
        updatedAt: review.updatedAt.toISOString(),
        user: {
          firstName: review.user.firstName,
          lastName: review.user.lastName
        },
        booking: {
          id: review.booking.id,
          serviceId: review.booking.serviceId,
          serviceName: 'Service Name', // Would be populated from service data
          scheduledTime: review.booking.scheduledTime.toISOString()
        }
      })),
      isOnline,
      ...(nextAvailableSlot && { nextAvailableSlot: nextAvailableSlot.toISOString() }),
      ...(analytics && { analytics })
    };

    return ApiResponse.success(
      responseData,
      'Barber details retrieved successfully'
    );

  } catch (error) {
    throw error;
  }
}

// Helper function to check if barber is online
async function checkBarberOnlineStatus(barberId: string): Promise<boolean> {
  try {
    // Check if barber has been active recently (simplified logic)
    const lastActivity = await cacheManager.get(`barber_activity:${barberId}`);
    if (!lastActivity) return false;

    const lastActivityTime = new Date(lastActivity as string);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return lastActivityTime > fiveMinutesAgo;
  } catch {
    return false;
  }
}

// Helper function to get next available slot
async function getNextAvailableSlot(barberId: string): Promise<Date | null> {
  try {
    // Get current time and check availability for the next 7 days
    const now = new Date();

    // This would use the BarberRepository's availability checking logic
    const availability = await barberRepository.checkAvailability({
      barberId,
      date: now,
      duration: 60 // Default 1 hour
    });

    const nextSlot = availability.find(slot => slot.available && slot.start > now);
    return nextSlot?.start || null;
  } catch {
    return null;
  }
}

// Helper function to get display analytics
async function getBarberDisplayAnalytics(barberId: string): Promise<any> {
  try {
    const analytics = await barberRepository.getBarberAnalytics(barberId, 30);

    return {
      totalBookings: analytics.totalBookings,
      completionRate: analytics.completionRate,
      responseTime: 24 // Hours - would be calculated from actual data
    };
  } catch {
    return {
      totalBookings: 0,
      completionRate: 0,
      responseTime: 24
    };
  }
}

// Apply middleware chain
const handler = withRateLimit({
  maxRequests: 200,
  windowMs: 60 * 1000, // 1 minute
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `get_barber_details:${ip}`;
  }
})(getBarberDetailsHandler);

export { handler as GET };