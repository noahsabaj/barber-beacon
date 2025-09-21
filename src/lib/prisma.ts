import { PrismaClient } from '@prisma/client';
import { env } from './env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Configure Prisma client with proper logging
const prismaClientSingleton = () => {
  // Validate DATABASE_URL is present
  if (!env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in environment variables');
    console.error('   Please configure your database connection in Vercel:');
    console.error('   1. Go to your Vercel project settings');
    console.error('   2. Navigate to Environment Variables');
    console.error('   3. Add DATABASE_URL with your Supabase/PostgreSQL connection string');
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  });

  // Add connection event listeners for better debugging
  prisma.$on('error' as never, (e: any) => {
    console.error('[Prisma] Database error:', e);
  });

  // Test connection on initialization in development
  if (process.env.NODE_ENV === 'development') {
    prisma.$connect()
      .then(() => {
        console.log('✅ Database connected successfully');
      })
      .catch((error) => {
        console.error('❌ Database connection failed:', error);
        console.error('   Please check your DATABASE_URL configuration');
      });
  }

  return prisma;
};

// Initialize Prisma client
let prisma: PrismaClient;

try {
  if (process.env.NODE_ENV === 'production') {
    prisma = prismaClientSingleton();
  } else {
    // In development, use global variable to prevent multiple instances
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = prismaClientSingleton();
    }
    prisma = globalForPrisma.prisma;
  }
} catch (error) {
  console.error('Failed to initialize Prisma client:', error);
  // Create a dummy client that will fail on first use with a helpful error
  prisma = new Proxy({} as PrismaClient, {
    get() {
      throw new Error(
        'Database connection not configured. Please set DATABASE_URL environment variable.'
      );
    },
  });
}

// Graceful shutdown
if (process.env.NODE_ENV !== 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });
}

export { prisma };
export default prisma;