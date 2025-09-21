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
import { LoginRequestDTO, LoginResponseDTO } from '@/lib/api/types/api-dtos';
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

async function loginHandler(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json() as LoginRequestDTO;

    // Extract device info for security logging
    const deviceInfo = {
      userAgent: request.headers.get('user-agent') || 'unknown',
      ipAddress: request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown',
      deviceType: ((): 'mobile' | 'desktop' | 'tablet' => {
        const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
        if (userAgent.includes('mobile')) return 'mobile';
        if (userAgent.includes('tablet')) return 'tablet';
        return 'desktop';
      })()
    };

    // Login user using AuthService
    const result = await authService.loginUser({
      email: body.email,
      password: body.password,
      rememberMe: body.rememberMe,
      deviceInfo
    });

    // Format response
    const responseData: LoginResponseDTO = {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt.toISOString(),
      requiresVerification: result.requiresVerification,
      requires2FA: result.requires2FA
    };

    // Determine success message
    let message = 'Login successful';
    if (result.requires2FA) {
      message = 'Two-factor authentication required. Please enter your verification code.';
    } else if (result.requiresVerification) {
      message = 'Login successful. Please verify your email address to access all features.';
    }

    return ApiResponse.success(responseData, message, 200);

  } catch (error) {
    // The error handling is managed by the validation middleware
    // and the ApiError classes will format the response correctly
    throw error;
  }
}

// Apply middleware chain with more restrictive rate limiting for login attempts
const handler = withRateLimit({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  skipSuccessfulRequests: false, // Count all attempts to prevent brute force
  keyGenerator: (request: NextRequest) => {
    // Rate limit by IP address and optionally by email if provided
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `login:${ip}`;
  }
})(
  withValidation(AuthValidationSchemas.login, {
    validateBody: true,
    validateResponse: true
  })(loginHandler)
);

export { handler as POST };