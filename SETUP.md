# Barber Beacon Setup Guide

## Prerequisites

1. **Node.js 20+** and npm
2. **PostgreSQL database** (Supabase recommended)
3. **Stripe account** for payments
4. **Twilio account** for SMS notifications
5. **SendGrid account** for email notifications
6. **Cloudflare R2** or AWS S3 for file storage
7. **Google Maps API key** for location services

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

### Required Environment Variables:

```bash
# Database - Use your PostgreSQL connection string
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# JWT Authentication - Generate a strong secret
JWT_SECRET="your_strong_jwt_secret_here"

# Stripe Payment Integration
STRIPE_SECRET_KEY="sk_live_..." # or sk_test_... for testing
STRIPE_PUBLISHABLE_KEY="pk_live_..." # or pk_test_... for testing
STRIPE_WEBHOOK_SECRET="whsec_..." # From Stripe webhook endpoint

# Twilio SMS
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="your_twilio_auth_token"
TWILIO_PHONE_NUMBER="+1234567890"

# SendGrid Email
SENDGRID_API_KEY="SG...."
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"

# Cloudflare R2 Storage
CLOUDFLARE_R2_ACCESS_KEY_ID="..."
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
CLOUDFLARE_R2_BUCKET_NAME="barber-beacon-assets"
CLOUDFLARE_R2_ENDPOINT="https://..."

# Google Maps
GOOGLE_MAPS_API_KEY="AIza..."

# Application
NEXTAUTH_SECRET="your_nextauth_secret"
NEXTAUTH_URL="http://localhost:3000" # Change for production
```

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# (Optional) Seed the database with sample data
npx prisma db seed
```

### 3. Stripe Webhook Configuration

1. Log into your Stripe Dashboard
2. Navigate to Webhooks
3. Create a new webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
4. Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Copy the webhook secret to your `.env` file

### 4. Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Production Deployment

### Frontend (Vercel)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

### Backend API

The API routes are part of the Next.js application and will be deployed with Vercel.

### Database Migrations

```bash
npx prisma migrate deploy
```

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Barber & Booking Endpoints

- `GET /api/barbers` - Search barbers by location
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - Get user bookings
- `PUT /api/bookings/[id]` - Update booking status

### Review Endpoints

- `POST /api/reviews` - Create review
- `GET /api/reviews` - Get reviews (optionally filtered by barber)
- `PUT /api/reviews/[id]` - Update review
- `DELETE /api/reviews/[id]` - Delete review

### Payment Endpoints

- `POST /api/payments/confirm` - Confirm payment status
- `POST /api/webhooks/stripe` - Stripe webhook handler

## Feature Overview

### Core Features Implemented:

✅ **User Authentication** - Registration, login, JWT tokens
✅ **Barber Profiles** - Business info, services, working hours
✅ **Location-Based Search** - Find barbers within radius
✅ **Real-Time Booking** - Appointment scheduling with availability checks
✅ **Stripe Payment Integration** - Secure payment processing
✅ **Review System** - Customer reviews and ratings
✅ **SMS/Email Notifications** - Booking confirmations and reminders
✅ **Responsive Design** - Mobile-friendly interface

### Key Differentiators vs. Yelp:

- **Integrated Booking**: No third-party redirects
- **Real-Time Availability**: 15-minute granularity
- **Service-Specific Pricing**: Individual service pricing
- **Automated Notifications**: SMS/email confirmations
- **Geolocation Search**: Radius-based filtering

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:auth
npm run test:booking
npm run test:integration
```

## Troubleshooting

### Common Issues:

1. **Database Connection Failed**
   - Verify DATABASE_URL is correct
   - Ensure database server is running
   - Check firewall/network settings

2. **Stripe Webhooks Not Working**
   - Verify webhook URL is accessible
   - Check webhook secret in environment variables
   - Ensure HTTPS in production

3. **SMS/Email Not Sending**
   - Verify Twilio/SendGrid credentials
   - Check account balances and limits
   - Validate phone numbers and email addresses

## Support

For technical support or questions:
- Check the GitHub Issues
- Review the API documentation
- Contact the development team

## License

This project is licensed under the MIT License.