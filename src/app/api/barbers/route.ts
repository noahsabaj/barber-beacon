import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api/base/ApiResponse';
import { BarberRepository } from '@/lib/api/repositories/BarberRepository';
import { CacheManager } from '@/lib/api/base/CacheManager';
import { MetricsCollector } from '@/lib/api/base/MetricsCollector';
import { withValidation } from '@/lib/api/middleware/validationMiddleware';
import { withRateLimit } from '@/lib/api/middleware/rateLimitMiddleware';
import { BarberValidationSchemas } from '@/lib/api/schemas/barberSchemas';
import {
  SearchBarbersResponseDTO
} from '@/lib/api/types/api-dtos';
import { ValidationError } from '@/lib/api/base/ApiError';
import { Location, SearchFilters } from '@/lib/api/types/entities';
import prisma from '@/lib/prisma';

// Initialize services
const cacheManager = new CacheManager();
const metricsCollector = new MetricsCollector();
const barberRepository = new BarberRepository(prisma, cacheManager, metricsCollector);

async function searchBarbersHandler(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate location
    const locationParam = searchParams.get('location');
    if (!locationParam) {
      throw new ValidationError('Location parameter is required (format: lat,lng)');
    }

    const [latStr, lngStr] = locationParam.split(',');
    if (!latStr || !lngStr) {
      throw new ValidationError('Invalid location format. Use: lat,lng');
    }
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lngStr);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new ValidationError('Invalid location format. Use: lat,lng');
    }

    // Parse other search parameters
    const radius = parseFloat(searchParams.get('radius') || '25');
    const query = searchParams.get('query') || undefined;
    const serviceTypes = searchParams.get('serviceTypes')?.split(',') || undefined;
    const minRating = searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined;
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
    const sortBy = searchParams.get('sortBy') as 'distance' | 'rating' | 'price' | 'availability' | 'newest' || 'distance';
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'asc';

    // Validate radius
    if (radius < 1 || radius > 50) {
      throw new ValidationError('Radius must be between 1 and 50 kilometers');
    }

    // Build search request
    const location: Location = { latitude, longitude };
    const filters: SearchFilters = {
      location,
      radius,
      sortBy,
      sortOrder,
      ...(query && { query }),
      ...(serviceTypes && { serviceTypes }),
      ...(minRating && { rating: minRating }),
      ...((minPrice || maxPrice) && {
        priceRange: {
          min: minPrice || 0,
          max: maxPrice || 10000
        }
      })
    };


    // Search barbers using BarberRepository
    const searchResult = await barberRepository.searchByLocation({
      latitude,
      longitude,
      radiusKm: radius,
      ...(serviceTypes && { serviceTypes }),
      ...(minRating !== undefined && { minRating }),
      ...(maxPrice !== undefined && { maxPrice }),
      sortBy: sortBy === 'availability' || sortBy === 'newest' ? 'distance' : sortBy,
      sortOrder
    });

    // Format response
    const responseData: SearchBarbersResponseDTO = {
      barbers: searchResult.data.map(barber => ({
        id: barber.id,
        businessName: barber.businessName,
        address: barber.address || '',
        city: barber.city || '',
        state: barber.state || '',
        rating: barber.rating,
        reviewCount: barber.reviewCount,
        portfolioImages: barber.portfolioImages || [],
        specialties: barber.specialties || [],
        amenities: barber.amenities || [],
        distance: barber.distance,
        matchScore: calculateMatchScore(barber, filters)
      })),
      pagination: {
        ...searchResult.pagination,
        hasNextPage: searchResult.pagination.hasNext,
        hasPreviousPage: searchResult.pagination.hasPrev
      },
      searchMetadata: {
        ...(query && { query }),
        location,
        totalResults: searchResult.pagination.total,
        searchTime: Date.now() - Date.now() // This would be calculated properly
      }
    };

    return ApiResponse.success(
      responseData,
      `Found ${responseData.barbers.length} barbers within ${radius}km`
    );

  } catch (error) {
    throw error;
  }
}

// Calculate match score based on search criteria
function calculateMatchScore(barber: any, filters: SearchFilters): number {
  let score = 100;

  // Distance score (closer = higher score)
  if (barber.distance) {
    const maxDistance = filters.radius || 25;
    const distanceScore = Math.max(0, 100 - (barber.distance / maxDistance) * 50);
    score = (score + distanceScore) / 2;
  }

  // Rating score
  if (barber.rating) {
    const ratingScore = (barber.rating / 5) * 100;
    score = (score + ratingScore) / 2;
  }

  // Query match score
  if (filters.query) {
    const queryLower = filters.query.toLowerCase();
    const businessNameMatch = barber.businessName?.toLowerCase().includes(queryLower);
    const descriptionMatch = barber.description?.toLowerCase().includes(queryLower);
    const specialtyMatch = barber.specialties?.some((s: string) =>
      s.toLowerCase().includes(queryLower)
    );

    if (businessNameMatch || descriptionMatch || specialtyMatch) {
      score += 10;
    }
  }

  return Math.min(100, Math.round(score));
}

// Apply middleware chain
const handler = withRateLimit({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `search_barbers:${ip}`;
  }
})(
  withValidation(BarberValidationSchemas.searchBarbers, {
    validateResponse: true,
    skipBodyValidation: true // GET request uses query params
  })(searchBarbersHandler)
);

export { handler as GET };