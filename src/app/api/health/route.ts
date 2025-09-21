import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const health = {
    status: 'checking',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    checks: {
      database: false,
      databaseUrl: false,
      jwtSecret: false,
    },
    message: '',
  };

  // Check environment variables
  health.checks.databaseUrl = !!process.env.DATABASE_URL;
  health.checks.jwtSecret = !!process.env.JWT_SECRET;

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = true;
    health.status = 'healthy';
    health.message = 'All systems operational';
  } catch (error) {
    health.status = 'unhealthy';
    health.message = 'Database connection failed';

    // In development, provide more details
    if (process.env.NODE_ENV === 'development') {
      health.message = `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  // Determine overall status
  if (!health.checks.databaseUrl) {
    health.status = 'critical';
    health.message = 'DATABASE_URL not configured. Please set it in Vercel environment variables.';
  } else if (!health.checks.jwtSecret) {
    health.status = 'critical';
    health.message = 'JWT_SECRET not configured. Please set it in Vercel environment variables.';
  }

  return NextResponse.json(health, {
    status: health.status === 'healthy' ? 200 : 503
  });
}