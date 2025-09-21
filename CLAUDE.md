# Barber Beacon - Claude AI Assistant Project Guide

## 🕐 **IMPORTANT: ALWAYS RUN `date` COMMAND FIRST**
**Current Date (September 2025)** - Run `date` command to check current date before making any year-based assumptions!

```bash
date
# Output: Fri Sep 19 01:31:55 PM EDT 2025
```

## 📁 **Complete Project Structure**

```
barber-beacon/
├── .env                          # Environment variables (NEVER commit)
├── .env.example                  # Environment template
├── .eslintrc.json               # ESLint configuration
├── .gitignore                   # Git ignore rules
├── CLAUDE.md                    # This file - Claude AI guide
├── README.md                    # Professional SaaS platform documentation
├── components.json              # shadcn/ui configuration
├── next.config.mjs              # Next.js configuration
├── next-env.d.ts                # Next.js TypeScript environment
├── package.json                 # Dependencies and scripts
├── package-lock.json            # Lock file
├── postcss.config.mjs           # PostCSS configuration
├── tailwind.config.ts           # Tailwind CSS configuration
├── tsconfig.json                # TypeScript configuration
├── tsconfig.tsbuildinfo         # TypeScript build info (generated)
├──
├── prisma/
│   ├── schema.prisma            # Database schema with all models
│   └── migrations/              # Database migration files
│       └── 20250919_init/       # Initial migration (created)
│
├── src/
│   ├── app/                     # Next.js 14 App Router
│   │   ├── globals.css          # Global styles with Tailwind
│   │   ├── layout.tsx           # Root layout with AuthProvider
│   │   ├── page.tsx             # Homepage with hero/features
│   │   ├── favicon.ico          # Site icon
│   │   ├── fonts/               # Geist fonts
│   │   │   ├── GeistVF.woff
│   │   │   └── GeistMonoVF.woff
│   │   ├──
│   │   ├── api/                 # API Routes (Backend)
│   │   │   ├── auth/            # Authentication endpoints
│   │   │   │   ├── login/route.ts       # User login with JWT
│   │   │   │   ├── logout/route.ts      # User logout
│   │   │   │   ├── me/route.ts          # Get current user
│   │   │   │   ├── refresh/route.ts     # Token refresh
│   │   │   │   ├── register/route.ts    # User registration with JWT
│   │   │   │   └── verify-email/route.ts # Email verification
│   │   │   ├──
│   │   │   ├── barbers/         # Barber search endpoints
│   │   │   │   ├── route.ts     # GET /api/barbers (location-based search)
│   │   │   │   └── [id]/route.ts # GET/PUT specific barber
│   │   │   ├──
│   │   │   ├── bookings/        # Booking management
│   │   │   │   ├── route.ts     # POST/GET bookings
│   │   │   │   └── [id]/route.ts # GET/PUT specific booking
│   │   │   ├──
│   │   │   ├── reviews/         # Review system
│   │   │   │   ├── route.ts     # POST/GET reviews
│   │   │   │   └── [id]/route.ts # GET/PUT/DELETE specific review
│   │   │   ├──
│   │   │   ├── payments/        # Payment handling
│   │   │   │   └── confirm/route.ts # Payment confirmation
│   │   │   ├──
│   │   │   └── webhooks/        # External webhooks
│   │   │       └── stripe/route.ts # Stripe payment webhooks
│   │   ├──
│   │   ├── auth/                # Authentication pages (COMPLETED)
│   │   │   ├── login/page.tsx           # Professional login page
│   │   │   ├── register/page.tsx        # Role-based registration
│   │   │   └── forgot-password/page.tsx # Password reset (template)
│   │   ├──
│   │   ├── barbers/             # Barber discovery pages (COMPLETED)
│   │   │   ├── page.tsx                 # Search with map & filters
│   │   │   ├── [id]/page.tsx           # Individual barber profile
│   │   │   └── [id]/book/page.tsx      # Booking appointment page
│   │   ├──
│   │   ├── barber-dashboard/    # Barber business dashboard (COMPLETED)
│   │   │   └── page.tsx                 # Business management interface
│   │   ├──
│   │   ├── booking/             # Booking flow pages (COMPLETED)
│   │   │   ├── confirmation/page.tsx    # Booking confirmation
│   │   │   └── payment/page.tsx         # Payment processing
│   │   ├──
│   │   ├── bookings/            # Booking management pages
│   │   │   └── page.tsx                 # Booking list/management
│   │   ├──
│   │   └── dashboard/           # Customer dashboard (COMPLETED)
│   │       └── page.tsx                 # Customer booking management
│   │
│   ├── components/              # React Components
│   │   ├── Navigation.tsx       # Main navigation with auth state
│   │   ├── LocationMap.tsx      # OpenStreetMap display component
│   │   ├── LocationSearch.tsx   # Address search with autocomplete
│   │   ├── ErrorBoundary/       # Error boundary components
│   │   │   ├── APIErrorBoundary.tsx     # API error handling
│   │   │   ├── FeatureErrorBoundary.tsx # Feature-specific errors
│   │   │   └── GlobalErrorBoundary.tsx  # Global error handling
│   │   ├── shared/              # Shared components
│   │   │   └── LoadingSpinner.tsx       # Loading indicator
│   │   └── ui/                  # shadcn/ui components
│   │       ├── alert.tsx        # Alert component
│   │       ├── alert-dialog.tsx # Alert dialog component
│   │       ├── avatar.tsx       # Avatar component
│   │       ├── badge.tsx        # Badge component
│   │       ├── button.tsx       # Button component
│   │       ├── calendar.tsx     # Calendar component
│   │       ├── card.tsx         # Card component
│   │       ├── checkbox.tsx     # Checkbox component
│   │       ├── collapsible.tsx  # Collapsible component
│   │       ├── dialog.tsx       # Dialog component
│   │       ├── form.tsx         # Form component
│   │       ├── input.tsx        # Input component
│   │       ├── label.tsx        # Label component
│   │       ├── progress.tsx     # Progress component
│   │       ├── select.tsx       # Select component
│   │       ├── separator.tsx    # Separator component
│   │       ├── slider.tsx       # Slider component
│   │       ├── table.tsx        # Table component
│   │       ├── tabs.tsx         # Tabs component
│   │       └── textarea.tsx     # Textarea component
│   │
│   ├── contexts/                # React Contexts
│   │   └── AuthContext.tsx      # Authentication state management
│   │
│   ├── features/                # Feature-based architecture
│   │   ├── auth/                # Authentication feature
│   │   │   ├── components/      # Auth-specific components
│   │   │   ├── hooks/           # Auth-specific hooks
│   │   │   ├── index.ts         # Feature exports
│   │   │   └── utils/           # Auth utilities
│   │   ├── barbers/             # Barber management feature
│   │   │   ├── components/      # Barber-specific components
│   │   │   ├── hooks/           # Barber-specific hooks
│   │   │   ├── index.ts         # Feature exports
│   │   │   └── utils/           # Barber utilities
│   │   └── bookings/            # Booking management feature
│   │       ├── components/      # Booking-specific components
│   │       ├── hooks/           # Booking-specific hooks
│   │       ├── index.ts         # Feature exports
│   │       └── utils/           # Booking utilities
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── auth/                # Authentication hooks
│   │   │   └── useAuth.ts       # Authentication state management
│   │   ├── barbers/             # Barber-related hooks
│   │   │   └── useBarbers.ts    # Barber data management
│   │   ├── bookings/            # Booking-related hooks
│   │   │   └── useBookings.ts   # Booking data management
│   │   └── shared/              # Shared hooks
│   │
│   ├── lib/                     # Utility Libraries
│   │   ├── api/                 # API layer architecture
│   │   │   ├── base/            # Base API configurations
│   │   │   ├── examples/        # API usage examples
│   │   │   ├── index.ts         # API exports
│   │   │   ├── middleware/      # API middleware
│   │   │   ├── repositories/    # Data access layer
│   │   │   ├── schemas/         # API schemas
│   │   │   ├── services/        # Business logic services
│   │   │   ├── types/           # API type definitions
│   │   │   └── utils/           # API utilities
│   │   ├── auth.ts              # Password hashing & validation (bcryptjs)
│   │   ├── geocoding.ts         # OpenStreetMap geocoding utilities
│   │   ├── jwt.ts               # JWT token management
│   │   ├── middleware.ts        # Auth & rate limiting middleware
│   │   ├── prisma.ts            # Database client
│   │   ├── sendgrid.ts          # Email notifications
│   │   ├── stripe.ts            # Payment processing
│   │   ├── twilio.ts            # SMS notifications
│   │   ├── utils.ts             # shadcn/ui utility functions
│   │   ├── validation.ts        # Data validation utilities
│   │   └── validation-constants.ts # Single source of truth for validation
│   │
│   ├── providers/               # React Context Providers
│   │   ├── QueryProvider.tsx    # React Query provider
│   │   └── StoreProvider.tsx    # Store provider (Zustand)
│   │
│   ├── stores/                  # State management (Zustand)
│   │   ├── authStore.ts         # Authentication store
│   │   ├── notificationStore.ts # Notification store
│   │   └── uiStore.ts           # UI state store
│   │
│   └── types/                   # TypeScript Interfaces
│       └── index.ts             # All type definitions
│
└── node_modules/                # Dependencies (auto-generated)
```

## 🔧 **Technology Stack (September 2025)**

### **Frontend**
- **Next.js 14** - App Router with TypeScript
- **React 18** - UI library
- **Tailwind CSS** - Styling framework
- **React Leaflet 4.2.1** - OpenStreetMap integration (free alternative to Google Maps)
- **React Query** - Data fetching and state management

### **Backend**
- **Next.js API Routes** - Serverless backend
- **Prisma ORM** - Database management
- **PostgreSQL** - Database (via Supabase)
- **JWT** - Authentication tokens

### **Services & APIs**
- **Supabase** - PostgreSQL database hosting
- **Stripe** - Payment processing
- **Twilio** - SMS notifications
- **SendGrid** - Email notifications (or SMTP2GO free alternative)
- **Cloudflare R2** - File storage for barber portfolios
- **OpenStreetMap Nominatim** - Free geocoding service

## 🗄️ **Database Models (Prisma Schema)**

### **Core Models**
1. **User** - Customer/barber accounts with authentication
2. **BarberProfile** - Business info, location, services, portfolio
3. **Service** - Individual services offered by barbers
4. **Booking** - Appointment scheduling with payment tracking
5. **Review** - Customer ratings and comments
6. **Payment** - Stripe payment records

### **Key Relationships**
- User → BarberProfile (one-to-one)
- BarberProfile → Service[] (one-to-many)
- User + BarberProfile + Service → Booking (many-to-one)
- Booking → Review (one-to-one)
- Booking → Payment (one-to-one)

## 🔐 **Authentication Flow**

1. **Registration**: `POST /api/auth/register` → bcrypt hash → JWT token
2. **Login**: `POST /api/auth/login` → verify password → JWT token
3. **Protected Routes**: Middleware verifies JWT → adds user to request
4. **Role-based Access**: Customer/barber/admin permissions

## 💳 **Payment Flow**

1. **Booking Creation**: Customer selects service → creates booking (pending payment)
2. **Stripe Integration**: Creates payment intent → returns client secret
3. **Frontend Payment**: Stripe Elements → processes payment
4. **Webhook Handler**: Stripe webhook → updates booking status → sends notifications

## 🗺️ **Location System (OpenStreetMap - FREE)**

### **Components**
- **LocationSearch.tsx** - Address autocomplete using Nominatim API
- **LocationMap.tsx** - Interactive map display with markers
- **geocoding.ts** - Utility functions for address ↔ coordinates

### **Features**
- ✅ Free address search and geocoding
- ✅ Current location detection
- ✅ Distance calculations
- ✅ Interactive map with markers
- ✅ No API key required!

## 📱 **Core Features Status**

### ✅ **Completed**
- User authentication (register/login/JWT)
- Database schema and migrations
- Barber search with geolocation filtering
- Booking system with availability checks
- Stripe payment integration with webhooks
- Review system with ratings
- SMS/Email notification setup
- OpenStreetMap integration (free!)
- Rate limiting and security middleware
- Frontend components and navigation

### 🔄 **In Progress**
- Cloudflare R2 API keys (optional for file uploads)
- Local testing and debugging

### 📋 **Pending**
- Frontend pages (auth, search, booking, dashboard)
- Vercel deployment
- Stripe webhook configuration
- Production testing

## 🚀 **Deployment Strategy**

### **Environment Variables Needed**
```bash
# Required for core functionality
DATABASE_URL="postgresql://..."           # Supabase connection
JWT_SECRET="..."                         # Random secure string
STRIPE_SECRET_KEY="sk_test_..."          # Stripe secret key
STRIPE_PUBLISHABLE_KEY="pk_test_..."     # Stripe publishable key

# Notifications (recommended)
TWILIO_ACCOUNT_SID="AC..."               # Twilio account SID
TWILIO_AUTH_TOKEN="..."                  # Twilio auth token
TWILIO_PHONE_NUMBER="+18666122896"       # Twilio phone number
SENDGRID_API_KEY="SG...."                # SendGrid or SMTP2GO API key
SENDGRID_FROM_EMAIL="your@email.com"     # Verified sender email

# File storage (optional)
CLOUDFLARE_R2_ACCESS_KEY_ID="..."        # R2 access key
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."    # R2 secret key
CLOUDFLARE_R2_BUCKET_NAME="barber-beacon-0"
CLOUDFLARE_R2_ENDPOINT="https://..."     # R2 endpoint URL
```

### **Deployment Steps**
1. **Vercel Deployment** - Connect GitHub repo → auto-deploy
2. **Environment Variables** - Add to Vercel dashboard
3. **Database Migrations** - Run `npx prisma migrate deploy`
4. **Stripe Webhook** - Configure webhook URL in Stripe dashboard
5. **Testing** - Verify all functionality works in production

## 🔍 **Key Differentiators vs. Yelp**

1. **Integrated Booking** - No third-party redirects, seamless flow
2. **Real-Time Availability** - 15-minute granularity with conflict detection
3. **Service-Specific Pricing** - Individual pricing per service type
4. **Automated Notifications** - SMS/email confirmations and reminders
5. **Geolocation Search** - Precise distance-based filtering
6. **Free Technology Stack** - No Google Maps fees, open-source solutions

## 🧰 **Development Commands**

```bash
# Development
npm run dev                    # Start development server
npm run build                  # Build for production
npm run start                  # Start production server

# Database
npm run db:generate           # Generate Prisma client
npm run db:migrate:dev        # Create and run migrations
npm run db:migrate            # Deploy migrations (production)
npm run db:studio            # Open Prisma Studio

# Quality
npm run lint                  # Run ESLint
npm run typecheck            # TypeScript checking
```

## 🛡️ **Security Features**

- **Password Hashing** - bcrypt with 12 salt rounds
- **JWT Authentication** - Secure token-based auth
- **Rate Limiting** - 100 requests per 15 minutes per IP
- **Input Validation** - Comprehensive data validation
- **SQL Injection Prevention** - Prisma parameterized queries
- **CORS Protection** - Configured for production domains
- **Environment Variables** - All secrets in .env (never committed)

## 📊 **API Endpoints Reference**

### **Authentication**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (requires auth)

### **Barbers**
- `GET /api/barbers?location=lat,lng&radius=5&service=cut` - Search barbers

### **Bookings**
- `POST /api/bookings` - Create booking (requires auth)
- `GET /api/bookings` - Get user bookings (requires auth)
- `GET /api/bookings/[id]` - Get specific booking (requires auth)
- `PUT /api/bookings/[id]` - Update booking status (requires auth)

### **Reviews**
- `POST /api/reviews` - Create review (requires auth)
- `GET /api/reviews?barberId=xyz` - Get reviews
- `PUT /api/reviews/[id]` - Update review (requires auth)
- `DELETE /api/reviews/[id]` - Delete review (requires auth)

### **Payments**
- `POST /api/payments/confirm` - Confirm payment status (requires auth)
- `POST /api/webhooks/stripe` - Stripe webhook handler

## 🎯 **Next Development Priorities**

1. **Complete Environment Setup** - Finish Cloudflare R2 credentials
2. **Frontend Pages** - Build auth, search, booking, and dashboard pages
3. **Testing** - Comprehensive local testing of all features
4. **Production Deployment** - Deploy to Vercel with all services
5. **User Experience** - Polish UI/UX and add loading states
6. **Performance** - Optimize database queries and add caching

## 🔧 **Troubleshooting Common Issues**

### **Database Connection**
```bash
# Test connection
npm run db:generate
npx prisma studio
```

### **TypeScript Errors**
```bash
npm run typecheck
```

### **Authentication Issues**
- Check JWT_SECRET is set
- Verify bcrypt password hashing
- Test token generation/verification

### **Payment Issues**
- Verify Stripe keys are correct
- Check webhook endpoint URL
- Monitor Stripe dashboard for events

---

**Built with ❤️ using Claude AI (September 2025)**

*Remember: Always run `date` command to check current year before searching for documentation!*