import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api/base/ApiResponse';
import { AuthService } from '@/lib/api/services/AuthService';
import { UserRepository } from '@/lib/api/repositories/UserRepository';
import { NotificationService } from '@/lib/api/services/NotificationService';
import { CacheManager } from '@/lib/api/base/CacheManager';
import { MetricsCollector } from '@/lib/api/base/MetricsCollector';
import { withValidation } from '@/lib/api/middleware/validationMiddleware';
import { withRateLimit } from '@/lib/api/middleware/rateLimitMiddleware';
import { AuthValidationSchemas } from '@/lib/api/schemas/authSchemas';
import { RefreshTokenRequestDTO, RefreshTokenResponseDTO } from '@/lib/api/types/api-dtos';
import prisma from '@/lib/prisma';

// Initialize services
const cacheManager = new CacheManager();
const metricsCollector = new MetricsCollector();
const userRepository = new UserRepository(prisma);
const notificationService = new NotificationService(
  userRepository,
  {} as any, // BookingRepository
  {} as any, // BarberRepository
  cacheManager,
  metricsCollector
);
const authService = new AuthService(
  userRepository,
  cacheManager,
  metricsCollector,
  notificationService
);

async function refreshTokenHandler(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json() as RefreshTokenRequestDTO;

    // Refresh access token using AuthService
    const result = await authService.refreshAccessToken(body.refreshToken);

    // Format response
    const responseData: RefreshTokenResponseDTO = {
      accessToken: result.accessToken,
      expiresAt: result.expiresAt.toISOString()
    };

    return ApiResponse.success(
      responseData,
      'Access token refreshed successfully'
    );

  } catch (error) {
    throw error;
  }
}

// Apply middleware chain
const handler = withRateLimit({
  maxRequests: 20,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `refresh:${ip}`;
  }
})(
  withValidation(AuthValidationSchemas.refreshToken, {
    validateBody: true,
    validateResponse: true
  })(refreshTokenHandler)
);

export { handler as POST };