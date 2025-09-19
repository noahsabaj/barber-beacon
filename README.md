# 💈 Barber Beacon

**The Modern Barbershop Discovery & Booking Platform**

Barber Beacon is a comprehensive SaaS platform that revolutionizes how customers find and book barber services. Built with modern web technologies, it provides seamless booking experiences, integrated payments, and powerful business management tools for barbershops.

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-blue?style=for-the-badge)](https://barber-beacon.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js_14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deployed_on_Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)

---

## 🎯 **Key Features**

### **For Customers**
- 🔍 **Smart Barber Discovery** - Location-based search with distance filtering
- 📅 **Real-Time Booking** - 15-minute granularity with conflict detection
- 💳 **Integrated Payments** - Secure Stripe payment processing
- ⭐ **Review System** - Rate and review barber services
- 📱 **Mobile Optimized** - Responsive design for all devices
- 🗺️ **Interactive Maps** - OpenStreetMap integration (no API fees!)

### **For Barbers**
- 🏪 **Professional Profiles** - Showcase services, pricing, and portfolio
- 📊 **Business Dashboard** - Manage bookings, availability, and earnings
- 💼 **Service Management** - Define custom services with pricing
- 🔔 **Automated Notifications** - SMS and email confirmations
- 📈 **Analytics** - Track performance and customer feedback
- 🎨 **Portfolio Upload** - Cloudflare R2 powered image storage

### **Platform Features**
- 🔐 **Secure Authentication** - JWT-based with role management
- 🛡️ **Rate Limiting** - Built-in API protection
- 📧 **Email Notifications** - SendGrid integration
- 📱 **SMS Alerts** - Twilio integration
- 🌍 **Free Geocoding** - OpenStreetMap Nominatim API
- ⚡ **Serverless Architecture** - Optimized for Vercel deployment

---

## 🛠️ **Tech Stack**

### **Frontend**
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Modern component library
- **React Hook Form** - Form management with validation
- **React Leaflet** - Interactive maps
- **React Query** - Data fetching and state management

### **Backend**
- **Next.js API Routes** - Serverless backend
- **Prisma ORM** - Type-safe database access
- **PostgreSQL** - Primary database (Supabase)
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing (serverless compatible)

### **Integrations**
- **Stripe** - Payment processing
- **Twilio** - SMS notifications
- **SendGrid** - Email notifications
- **Cloudflare R2** - File storage
- **OpenStreetMap** - Maps and geocoding
- **Supabase** - PostgreSQL hosting

### **Deployment**
- **Vercel** - Hosting and serverless functions
- **GitHub** - Version control and CI/CD
- **Prisma Migrate** - Database migrations

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+
- PostgreSQL database (or Supabase account)
- Required API keys (see Environment Variables section)

### **1. Clone & Install**
```bash
git clone https://github.com/noahsabaj/barber-beacon.git
cd barber-beacon
npm install
```

### **2. Environment Setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

### **3. Database Setup**
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:dev

# (Optional) Open Prisma Studio
npm run db:studio
```

### **4. Development Server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

---

## 🌍 **Deployment**

### **Vercel Deployment (Recommended)**

1. **Connect Repository**
   ```bash
   # Deploy to Vercel
   vercel --prod
   ```

2. **Configure Environment Variables**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add all required variables from `.env.example`

3. **Database Migrations**
   ```bash
   # Run in production
   npx prisma migrate deploy
   ```

4. **Stripe Webhook Configuration**
   - Set webhook URL: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Enable required events: `payment_intent.succeeded`, `payment_intent.payment_failed`

---

## 🔧 **Environment Variables**

### **Required Variables**
```bash
# Database (Required)
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Authentication (Required)
JWT_SECRET="your_strong_secret_here"

# Payments (Required)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### **Optional Variables**
```bash
# SMS Notifications
TWILIO_ACCOUNT_SID="AC..."
TWILIO_AUTH_TOKEN="..."
TWILIO_PHONE_NUMBER="+1234567890"

# Email Notifications
SENDGRID_API_KEY="SG...."
SENDGRID_FROM_EMAIL="noreply@barberbeacon.com"

# File Storage
CLOUDFLARE_R2_ACCESS_KEY_ID="..."
CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
CLOUDFLARE_R2_BUCKET_NAME="barber-beacon"
CLOUDFLARE_R2_ENDPOINT="https://..."
```

See `.env.example` for complete configuration options.

---

## 📊 **Database Schema**

```mermaid
erDiagram
    User ||--o| BarberProfile : has
    User ||--o{ Booking : creates
    BarberProfile ||--o{ Service : offers
    BarberProfile ||--o{ Booking : receives
    Service ||--o{ Booking : included_in
    Booking ||--o| Review : has
    Booking ||--o| Payment : has

    User {
        string id PK
        string email UK
        string password
        string role
        string firstName
        string lastName
        string phone
        string address
        datetime createdAt
    }

    BarberProfile {
        string id PK
        string userId FK
        string businessName
        string bio
        json location
        float hourlyRate
        string[] availability
        string[] portfolio
        datetime createdAt
    }

    Service {
        string id PK
        string barberId FK
        string name
        string description
        float price
        int duration
        string category
    }

    Booking {
        string id PK
        string customerId FK
        string barberId FK
        string serviceId FK
        datetime dateTime
        string status
        string paymentStatus
        float totalAmount
    }

    Review {
        string id PK
        string bookingId FK
        string customerId FK
        string barberId FK
        int rating
        string comment
        datetime createdAt
    }

    Payment {
        string id PK
        string bookingId FK
        string stripePaymentIntentId
        float amount
        string status
        datetime createdAt
    }
```

---

## 🔌 **API Documentation**

### **Authentication Endpoints**
```bash
POST /api/auth/register    # User registration
POST /api/auth/login       # User login
GET  /api/auth/me          # Get current user
```

### **Barber Discovery**
```bash
GET /api/barbers?lat=40.7128&lng=-74.0060&radius=5&service=haircut
```

### **Booking Management**
```bash
POST /api/bookings         # Create booking
GET  /api/bookings         # Get user bookings
GET  /api/bookings/[id]    # Get specific booking
PUT  /api/bookings/[id]    # Update booking
```

### **Review System**
```bash
POST   /api/reviews        # Create review
GET    /api/reviews        # Get reviews
PUT    /api/reviews/[id]   # Update review
DELETE /api/reviews/[id]   # Delete review
```

### **Payment Processing**
```bash
POST /api/payments/confirm         # Confirm payment
POST /api/webhooks/stripe         # Stripe webhook handler
```

---

## 🎨 **Key Differentiators**

### **vs. Yelp**
- ✅ **Integrated Booking** - No third-party redirects
- ✅ **Real-Time Availability** - Live scheduling system
- ✅ **Service-Specific Pricing** - Granular pricing per service
- ✅ **Automated Workflows** - SMS/Email confirmations
- ✅ **Modern UI/UX** - Built for mobile-first experience

### **vs. Traditional Booking Systems**
- ✅ **Free Technology Stack** - No Google Maps fees
- ✅ **Serverless Architecture** - Scales automatically
- ✅ **Open Source Maps** - OpenStreetMap integration
- ✅ **Modern Payment Flow** - Stripe Elements integration
- ✅ **Real-Time Updates** - Live booking confirmations

---

## 📱 **Screenshots**

### **Homepage**
*Modern landing page with hero section and feature highlights*

### **Barber Discovery**
*Location-based search with interactive map and filtering*

### **Booking Flow**
*Seamless appointment scheduling with real-time availability*

### **Barber Dashboard**
*Professional business management interface*

### **Mobile Experience**
*Fully responsive design optimized for mobile devices*

---

## 🧪 **Development**

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking

# Database commands
npm run db:generate  # Generate Prisma client
npm run db:migrate:dev    # Create and apply migration
npm run db:migrate        # Apply migrations (production)
npm run db:studio         # Open Prisma Studio
```

### **Code Quality**
- **ESLint** - Code linting with Next.js recommended rules
- **TypeScript** - Strict type checking enabled
- **Prettier** - Code formatting (configured via ESLint)
- **Git Hooks** - Pre-commit validation (if configured)

---

## 🤝 **Contributing**

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### **Development Guidelines**
- Follow TypeScript best practices
- Write clear, descriptive commit messages
- Add tests for new features
- Update documentation as needed
- Ensure all checks pass before submitting PR

---

## 🛡️ **Security**

- **Authentication** - JWT tokens with secure headers
- **Password Hashing** - bcryptjs with 12 salt rounds
- **Rate Limiting** - 100 requests per 15 minutes per IP
- **Input Validation** - Comprehensive data validation with Zod
- **SQL Injection Prevention** - Prisma parameterized queries
- **CORS Protection** - Configured for production domains
- **Environment Security** - All secrets in environment variables

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- **Next.js Team** - For the amazing React framework
- **Vercel** - For seamless deployment platform
- **OpenStreetMap** - For free, open-source mapping
- **shadcn/ui** - For beautiful, accessible components
- **Stripe** - For robust payment processing
- **Supabase** - For managed PostgreSQL hosting

---

## 📞 **Support**

- **Documentation** - Check our [setup guide](SETUP.md)
- **Issues** - Report bugs via [GitHub Issues](https://github.com/noahsabaj/barber-beacon/issues)
- **Discussions** - Join community discussions

---

**Built with ❤️ using Next.js, TypeScript, and modern web technologies**

*Barber Beacon - Connecting customers with skilled barbers, one appointment at a time.*