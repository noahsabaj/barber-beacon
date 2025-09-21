import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { ApiError, AuthenticationError, AuthorizationError } from '../base/ApiError';
import { globalMetrics } from '../base/MetricsCollector';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  isEmailVerified: boolean;
}

export interface AuthenticatedRequest extends NextRequest {
  user: AuthenticatedUser;
}

export interface AuthMiddlewareOptions {
  requireEmailVerification?: boolean;
  allowedRoles?: string[];
  optional?: boolean;
}

export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const start = Date.now();

    try {
      const token = extractToken(request);

      if (!token) {
        if (options.optional) {
          // If auth is optional and no token, proceed without user
          return handler(request as AuthenticatedRequest);
        }

        globalMetrics.recordError('auth_middleware', 'Missing authentication token');
        throw new AuthenticationError('Authentication required');
      }

      let payload;
      try {
        payload = await verifyToken(token);
      } catch (error) {
        globalMetrics.recordError('auth_middleware', 'Invalid token');
        throw new AuthenticationError('Invalid authentication token');
      }

      // Extract user info from JWT payload
      const user: AuthenticatedUser = {
        userId: payload.userId as string,
        email: payload.email as string,
        role: payload.role as string,
        isEmailVerified: payload.isEmailVerified as boolean,
      };

      // Check email verification if required
      if (options.requireEmailVerification && !user.isEmailVerified) {
        globalMetrics.recordError('auth_middleware', 'Email not verified');
        throw new AuthorizationError('Email verification required');
      }

      // Check role permissions if specified
      if (options.allowedRoles && !options.allowedRoles.includes(user.role)) {
        globalMetrics.recordError('auth_middleware', 'Insufficient permissions');
        throw new AuthorizationError('Insufficient permissions');
      }

      // Attach user to request
      (request as AuthenticatedRequest).user = user;

      const duration = Date.now() - start;
      globalMetrics.recordPerformance('auth_middleware', duration, true);

      return handler(request as AuthenticatedRequest);

    } catch (error) {
      const duration = Date.now() - start;
      globalMetrics.recordPerformance('auth_middleware', duration, false);

      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }

      globalMetrics.recordError('auth_middleware', error instanceof Error ? error : 'Unknown error');
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

export function requireAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(handler, { requireEmailVerification: true });
}

export function requireRole(
  roles: string | string[],
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return withAuth(handler, {
    requireEmailVerification: true,
    allowedRoles
  });
}

export function requireBarber(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return requireRole(['barber', 'admin'], handler);
}

export function requireCustomer(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return requireRole(['customer', 'admin'], handler);
}

export function requireAdmin(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return requireRole('admin', handler);
}

export function optionalAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(handler, { optional: true });
}

function extractToken(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie as fallback
  const tokenCookie = request.cookies.get('auth-token');
  if (tokenCookie) {
    return tokenCookie.value;
  }

  return null;
}

// Helper to get user from request (for use in handlers)
export function getUser(request: NextRequest): AuthenticatedUser | null {
  return (request as AuthenticatedRequest).user || null;
}

// Helper to check if user has specific role
export function hasRole(request: NextRequest, role: string | string[]): boolean {
  const user = getUser(request);
  if (!user) return false;

  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(user.role);
}

// Helper to check if user is owner of resource
export function isOwner(request: NextRequest, resourceUserId: string): boolean {
  const user = getUser(request);
  return user?.userId === resourceUserId || user?.role === 'admin';
}