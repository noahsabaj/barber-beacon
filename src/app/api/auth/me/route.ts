import { NextRequest } from 'next/server';
import { ApiResponse } from '@/lib/api/base/ApiResponse';
import { UserRepository } from '@/lib/api/repositories/UserRepository';
import { CacheManager } from '@/lib/api/base/CacheManager';
import { MetricsCollector } from '@/lib/api/base/MetricsCollector';
import { withRateLimit } from '@/lib/api/middleware/rateLimitMiddleware';
import { PublicUserProfile } from '@/lib/api/types/entities';
import { AuthenticationError, NotFoundError } from '@/lib/api/base/ApiError';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';

// Initialize services
const cacheManager = new CacheManager();
const metricsCollector = new MetricsCollector();
const userRepository = new UserRepository(prisma);

async function getCurrentUserHandler(request: NextRequest): Promise<Response> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No valid authorization token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify and decode token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Get user from database with related data
    const user = await userRepository.findById(decoded.userId || decoded.id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get additional profile data based on user role
    let profileData = null;
    if (user.role === 'BARBER') {
      try {
        const barberProfile = await prisma.barberProfile.findUnique({
          where: { userId: user.id },
          include: {
            services: {
              where: { isActive: true },
              orderBy: { name: 'asc' }
            }
          }
        });
        profileData = barberProfile;
      } catch (error) {
        // Continue without barber profile if not found
      }
    }

    // Create public user profile
    const publicUser: PublicUserProfile = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      phoneNumber: user.phoneNumber,
      createdAt: user.createdAt
    };

    // Add profile data if available
    const responseData = {
      user: publicUser,
      ...(profileData && { barberProfile: profileData }),
      lastActivity: new Date().toISOString()
    };

    // Update last activity in cache
    await cacheManager.set(
      `user_activity:${user.id}`,
      new Date(),
      300 // 5 minutes
    );

    // Record metrics
    metricsCollector.recordUserAction('get_current_user', user.id);

    return ApiResponse.success(
      responseData,
      'User information retrieved successfully'
    );

  } catch (error) {
    // The error handling is managed by the middleware
    // and the ApiError classes will format the response correctly
    throw error;
  }
}

// Apply middleware chain
const handler = withRateLimit({
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
  skipSuccessfulRequests: true,
  keyGenerator: (request: NextRequest) => {
    // Rate limit by user token if available, otherwise by IP
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      try {
        const token = authHeader.substring(7);
        const decoded = verifyToken(token);
        return `auth_me:${decoded.userId || decoded.id}`;
      } catch {
        // Fall back to IP-based rate limiting
      }
    }

    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               'unknown';
    return `auth_me:${ip}`;
  }
})(getCurrentUserHandler);

export { handler as GET };