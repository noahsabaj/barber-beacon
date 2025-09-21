import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api/base/ApiResponse';
import { AuthService } from '@/lib/api/services/AuthService';
import { UserRepository } from '@/lib/api/repositories/UserRepository';
import { NotificationService } from '@/lib/api/services/NotificationService';
import { CacheManager } from '@/lib/api/base/CacheManager';
import { MetricsCollector } from '@/lib/api/base/MetricsCollector';
import { withRateLimit } from '@/lib/api/middleware/rateLimitMiddleware';
import { AuthenticationError } from '@/lib/api/base/ApiError';
import { verifyToken } from '@/lib/jwt';
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

async function logoutHandler(request: NextRequest): Promise<Response> {
  try {
    // Extract tokens from headers and body
    const authHeader = request.headers.get('authorization');
    const body = await request.json().catch(() => ({}));
    const refreshToken = body.refreshToken;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No valid authorization token provided');
    }

    const accessToken = authHeader.substring(7);

    // Verify token to get user ID
    let decoded;
    try {
      decoded = verifyToken(accessToken);
    } catch (error) {
      // Token might be expired, but we should still try to logout
      // if we have a refresh token
      if (!refreshToken) {
        throw new AuthenticationError('Invalid token and no refresh token provided');
      }
    }

    const userId = decoded?.userId || decoded?.id;

    // Logout user using AuthService
    if (userId && refreshToken) {
      await authService.logoutUser(userId, refreshToken);
    }

    return ApiResponse.success(
      { message: 'Logged out successfully' },
      'You have been logged out successfully'
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
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        return `logout:${decoded.userId || decoded.id}`;
      } catch {
        // Fall back to IP-based rate limiting
      }
    }

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `logout:${ip}`;
  }
})(logoutHandler);

export { handler as POST };