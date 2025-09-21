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
import { RegisterRequestDTO, RegisterResponseDTO } from '@/lib/api/types/api-dtos';
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

async function registerHandler(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json() as RegisterRequestDTO;

    // Log request details in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[Register] Request received:', {
        email: body.email,
        role: body.role,
        timestamp: new Date().toISOString()
      });
    }

    // Register user using AuthService
    const result = await authService.registerUser({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role,
      phoneNumber: body.phoneNumber,
      acceptedTerms: body.acceptedTerms,
      marketingConsent: body.marketingConsent
    });

    // Format response
    const responseData: RegisterResponseDTO = {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt.toISOString(),
      requiresVerification: result.requiresVerification || false
    };

    return ApiResponse.success(
      responseData,
      result.requiresVerification
        ? 'Registration successful. Please check your email to verify your account.'
        : 'Registration successful.',
      201
    );

  } catch (error) {
    // Log error details for debugging
    console.error('[Register] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Handle Prisma connection errors specifically
    if (error instanceof Error) {
      if (error.message.includes('P1001') || error.message.includes('connect')) {
        return ApiResponse.error(
          'Database connection failed. Please try again later.',
          503,
          'DATABASE_CONNECTION_ERROR'
        );
      }
      if (error.message.includes('P2002') || error.message.includes('Unique constraint')) {
        return ApiResponse.error(
          'An account with this email already exists.',
          409,
          'EMAIL_ALREADY_EXISTS'
        );
      }
    }

    // Re-throw to let middleware handle other errors
    throw error;
  }
}

// Apply middleware chain
const handler = withRateLimit({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: true
})(
  withValidation(AuthValidationSchemas.register, {
    validateBody: true,
    validateResponse: true
  })(registerHandler)
);

export { handler as POST };