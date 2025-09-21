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
import { VerifyEmailRequestDTO } from '@/lib/api/types/api-dtos';
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

async function verifyEmailHandler(request: NextRequest): Promise<Response> {
  try {
    // Get token from query params or body
    const url = new URL(request.url);
    const tokenFromQuery = url.searchParams.get('token');

    let token = tokenFromQuery;

    // If no token in query, try to get from body
    if (!token) {
      const body = await request.json() as VerifyEmailRequestDTO;
      token = body.token;
    }

    if (!token) {
      throw new Error('Verification token is required');
    }

    // Verify email using AuthService
    const user = await authService.verifyEmail(token);

    return ApiResponse.success(
      {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified
        }
      },
      'Email verified successfully! You can now access all features.'
    );

  } catch (error) {
    throw error;
  }
}

// Apply middleware chain
const handler = withRateLimit({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (token) {
      return `verify_email:${token}`;
    }

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `verify_email:${ip}`;
  }
})(
  withValidation(AuthValidationSchemas.verifyEmail, {
    validateResponse: true,
    skipBodyValidation: true // Token can come from query params
  })(verifyEmailHandler)
);

export { handler as POST };
export { handler as GET }; // Support both POST and GET for email verification links