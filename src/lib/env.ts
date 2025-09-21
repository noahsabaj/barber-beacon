/**
 * Environment Variable Validation
 *
 * Ensures all required environment variables are present
 * and provides helpful error messages during development
 */

interface EnvConfig {
  // Database
  DATABASE_URL: string;

  // JWT Authentication
  JWT_SECRET: string;

  // Optional services
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;

  SENDGRID_API_KEY?: string;
  SENDGRID_FROM_EMAIL?: string;

  CLOUDFLARE_R2_ACCESS_KEY_ID?: string;
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string;
  CLOUDFLARE_R2_BUCKET_NAME?: string;
  CLOUDFLARE_R2_ENDPOINT?: string;

  // Application
  NEXTAUTH_SECRET?: string;
  NEXTAUTH_URL?: string;

  // Rate limiting
  RATE_LIMIT_REQUESTS_PER_WINDOW?: string;
  RATE_LIMIT_WINDOW_MS?: string;
}

class EnvironmentValidator {
  private static instance: EnvironmentValidator;
  private config: EnvConfig | null = null;
  private validationErrors: string[] = [];

  private constructor() {}

  static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }

  /**
   * Validate and return environment configuration
   */
  getConfig(): EnvConfig {
    if (this.config) {
      return this.config;
    }

    this.validationErrors = [];

    // Required variables
    const requiredVars = ['DATABASE_URL', 'JWT_SECRET'] as const;

    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        this.validationErrors.push(`Missing required environment variable: ${varName}`);
      }
    }

    // Check if we have any critical errors
    if (this.validationErrors.length > 0) {
      console.error('❌ Environment validation failed:');
      this.validationErrors.forEach(error => console.error(`   - ${error}`));

      // In production, throw error immediately
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Missing required environment variables');
      }

      // In development, provide helpful instructions
      console.warn('\n📝 Please set up your environment variables:');
      console.warn('   1. Copy .env.example to .env');
      console.warn('   2. Fill in the required values');
      console.warn('   3. Restart your development server\n');
    }

    // Check optional but recommended variables
    const recommendedVars = [
      'STRIPE_SECRET_KEY',
      'SENDGRID_API_KEY',
      'TWILIO_ACCOUNT_SID'
    ];

    const missingRecommended = recommendedVars.filter(v => !process.env[v]);
    if (missingRecommended.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Missing recommended environment variables:');
      missingRecommended.forEach(v => console.warn(`   - ${v}`));
    }

    // Build configuration object with conditional spreading for optional properties
    this.config = {
      DATABASE_URL: process.env['DATABASE_URL'] || '',
      JWT_SECRET: process.env['JWT_SECRET'] || '',

      ...(process.env['STRIPE_SECRET_KEY'] && { STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'] }),
      ...(process.env['STRIPE_PUBLISHABLE_KEY'] && { STRIPE_PUBLISHABLE_KEY: process.env['STRIPE_PUBLISHABLE_KEY'] }),
      ...(process.env['STRIPE_WEBHOOK_SECRET'] && { STRIPE_WEBHOOK_SECRET: process.env['STRIPE_WEBHOOK_SECRET'] }),

      ...(process.env['TWILIO_ACCOUNT_SID'] && { TWILIO_ACCOUNT_SID: process.env['TWILIO_ACCOUNT_SID'] }),
      ...(process.env['TWILIO_AUTH_TOKEN'] && { TWILIO_AUTH_TOKEN: process.env['TWILIO_AUTH_TOKEN'] }),
      ...(process.env['TWILIO_PHONE_NUMBER'] && { TWILIO_PHONE_NUMBER: process.env['TWILIO_PHONE_NUMBER'] }),

      ...(process.env['SENDGRID_API_KEY'] && { SENDGRID_API_KEY: process.env['SENDGRID_API_KEY'] }),
      ...(process.env['SENDGRID_FROM_EMAIL'] && { SENDGRID_FROM_EMAIL: process.env['SENDGRID_FROM_EMAIL'] }),

      ...(process.env['CLOUDFLARE_R2_ACCESS_KEY_ID'] && { CLOUDFLARE_R2_ACCESS_KEY_ID: process.env['CLOUDFLARE_R2_ACCESS_KEY_ID'] }),
      ...(process.env['CLOUDFLARE_R2_SECRET_ACCESS_KEY'] && { CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env['CLOUDFLARE_R2_SECRET_ACCESS_KEY'] }),
      ...(process.env['CLOUDFLARE_R2_BUCKET_NAME'] && { CLOUDFLARE_R2_BUCKET_NAME: process.env['CLOUDFLARE_R2_BUCKET_NAME'] }),
      ...(process.env['CLOUDFLARE_R2_ENDPOINT'] && { CLOUDFLARE_R2_ENDPOINT: process.env['CLOUDFLARE_R2_ENDPOINT'] }),

      ...(process.env['NEXTAUTH_SECRET'] && { NEXTAUTH_SECRET: process.env['NEXTAUTH_SECRET'] }),
      ...(process.env['NEXTAUTH_URL'] && { NEXTAUTH_URL: process.env['NEXTAUTH_URL'] }),

      ...(process.env['RATE_LIMIT_REQUESTS_PER_WINDOW'] && { RATE_LIMIT_REQUESTS_PER_WINDOW: process.env['RATE_LIMIT_REQUESTS_PER_WINDOW'] }),
      ...(process.env['RATE_LIMIT_WINDOW_MS'] && { RATE_LIMIT_WINDOW_MS: process.env['RATE_LIMIT_WINDOW_MS'] }),
    };

    return this.config;
  }

  /**
   * Check if all required environment variables are set
   */
  isValid(): boolean {
    this.getConfig();
    return this.validationErrors.length === 0;
  }

  /**
   * Get validation errors
   */
  getErrors(): string[] {
    return this.validationErrors;
  }

  /**
   * Check if a specific service is configured
   */
  isServiceConfigured(service: 'stripe' | 'twilio' | 'sendgrid' | 'cloudflare'): boolean {
    const config = this.getConfig();

    switch (service) {
      case 'stripe':
        return !!(config.STRIPE_SECRET_KEY && config.STRIPE_PUBLISHABLE_KEY);
      case 'twilio':
        return !!(config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN && config.TWILIO_PHONE_NUMBER);
      case 'sendgrid':
        return !!(config.SENDGRID_API_KEY && config.SENDGRID_FROM_EMAIL);
      case 'cloudflare':
        return !!(config.CLOUDFLARE_R2_ACCESS_KEY_ID && config.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
      default:
        return false;
    }
  }
}

// Export singleton instance methods
export const envValidator = EnvironmentValidator.getInstance();
export const env = envValidator.getConfig();

// Helper functions
export function validateEnv(): void {
  if (!envValidator.isValid()) {
    const errors = envValidator.getErrors();
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}

export function isServiceConfigured(service: 'stripe' | 'twilio' | 'sendgrid' | 'cloudflare'): boolean {
  return envValidator.isServiceConfigured(service);
}

// Development helper to log environment status
export function logEnvStatus(): void {
  if (process.env.NODE_ENV !== 'development') return;

  console.log('\n🔧 Environment Status:');
  console.log('   ✓ Database:', env.DATABASE_URL ? 'Configured' : '❌ Missing');
  console.log('   ✓ JWT:', env.JWT_SECRET ? 'Configured' : '❌ Missing');
  console.log('   - Stripe:', isServiceConfigured('stripe') ? '✓ Configured' : '⚠️ Not configured');
  console.log('   - Twilio:', isServiceConfigured('twilio') ? '✓ Configured' : '⚠️ Not configured');
  console.log('   - SendGrid:', isServiceConfigured('sendgrid') ? '✓ Configured' : '⚠️ Not configured');
  console.log('   - Cloudflare:', isServiceConfigured('cloudflare') ? '✓ Configured' : '⚠️ Not configured');
  console.log('');
}