import { UserRole, BookingStatus, PaymentStatus } from '@prisma/client';
import {
  EntityId,
  PublicUserProfile,
  BarberProfileSummary,
  SearchFilters,
  PaginationMeta,
  Location,
  BusinessHours,
  ReminderPreferences,
  NotificationPreferences
} from './entities';

// Re-export commonly used types
export type { PublicUserProfile } from './entities';

// ===========================================
// Authentication DTOs
// ===========================================

export interface RegisterRequestDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phoneNumber?: string;
  acceptedTerms: boolean;
  marketingConsent?: boolean;
}

export interface RegisterResponseDTO {
  user: PublicUserProfile;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  requiresVerification: boolean;
}

export interface LoginRequestDTO {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceInfo?: {
    userAgent: string;
    ipAddress: string;
    deviceType: 'mobile' | 'desktop' | 'tablet';
  };
}

export interface LoginResponseDTO {
  user: PublicUserProfile;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  requiresVerification?: boolean | undefined;
  requires2FA?: boolean | undefined;
}

export interface RefreshTokenRequestDTO {
  refreshToken: string;
}

export interface RefreshTokenResponseDTO {
  accessToken: string;
  expiresAt: string;
}

export interface ForgotPasswordRequestDTO {
  email: string;
}

export interface ResetPasswordRequestDTO {
  email: string;
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequestDTO {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyEmailRequestDTO {
  token: string;
}

export interface UpdateProfileRequestDTO {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
}

export interface UpdateProfileResponseDTO {
  user: PublicUserProfile;
  message: string;
}

// ===========================================
// Barber Profile DTOs
// ===========================================

export interface CreateBarberProfileRequestDTO {
  businessName: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  website?: string;
  instagramHandle?: string;
  businessHours: BusinessHours;
  specialties: string[];
  amenities: string[];
  businessLicense?: string;
  insuranceInfo?: string;
}

export interface UpdateBarberProfileRequestDTO {
  businessName?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phoneNumber?: string;
  website?: string;
  instagramHandle?: string;
  businessHours?: BusinessHours;
  specialties?: string[];
  amenities?: string[];
  isActive?: boolean;
}

export interface BarberProfileResponseDTO {
  id: EntityId;
  businessName: string;
  description?: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  website?: string;
  instagramHandle?: string;
  portfolioImages: string[];
  businessHours: BusinessHours;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  specialties: string[];
  amenities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BarberProfileDetailsResponseDTO extends BarberProfileResponseDTO {
  user: PublicUserProfile;
  services: ServiceResponseDTO[];
  recentReviews: ReviewResponseDTO[];
  isOnline: boolean;
  nextAvailableSlot?: string;
  analytics?: {
    totalBookings: number;
    completionRate: number;
    responseTime: number;
  };
}

export interface SearchBarbersRequestDTO {
  location?: Location;
  radius?: number;
  query?: string;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
}

export interface SearchBarbersResponseDTO {
  barbers: Array<BarberProfileSummary & {
    distance?: number;
    matchScore?: number;
  }>;
  pagination: PaginationMeta;
  searchMetadata: {
    query?: string;
    location?: Location;
    totalResults: number;
    searchTime: number;
  };
}

// ===========================================
// Service DTOs
// ===========================================

export interface CreateServiceRequestDTO {
  name: string;
  description?: string;
  duration: number;
  price: number;
  type: string;
  category: string;
  tags?: string[];
  requirements?: string;
  preparation?: string;
}

export interface UpdateServiceRequestDTO {
  name?: string;
  description?: string;
  duration?: number;
  price?: number;
  type?: string;
  category?: string;
  tags?: string[];
  requirements?: string;
  preparation?: string;
  isActive?: boolean;
}

export interface ServiceResponseDTO {
  id: EntityId;
  name: string;
  description?: string;
  duration: number;
  price: number;
  type: string;
  category: string;
  tags: string[];
  requirements?: string;
  preparation?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceWithBarberResponseDTO extends ServiceResponseDTO {
  barber: BarberProfileSummary;
}

// ===========================================
// Booking DTOs
// ===========================================

export interface CreateBookingRequestDTO {
  barberId: EntityId;
  serviceId: EntityId;
  scheduledTime: string; // ISO string
  notes?: string;
  paymentMethodId?: string;
  reminderPreferences?: ReminderPreferences;
}

export interface UpdateBookingRequestDTO {
  scheduledTime?: string;
  serviceId?: string;
  notes?: string;
  status?: BookingStatus;
}

export interface BookingResponseDTO {
  id: EntityId;
  scheduledTime: string;
  duration: number;
  totalPrice: number;
  status: BookingStatus;
  notes?: string;
  cancellationReason?: string;
  cancelledAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  user: PublicUserProfile;
  barber: BarberProfileSummary & {
    user: Pick<PublicUserProfile, 'firstName' | 'lastName'>;
  };
  service: ServiceResponseDTO;
  payment?: PaymentResponseDTO;
  review?: ReviewResponseDTO;
}

export interface BookingSearchRequestDTO {
  userId?: EntityId;
  barberId?: EntityId;
  status?: BookingStatus[];
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface BookingSearchResponseDTO {
  bookings: BookingResponseDTO[];
  pagination: PaginationMeta;
  summary: {
    totalBookings: number;
    upcomingBookings: number;
    completedBookings: number;
    totalSpent: number;
  };
}

export interface CancelBookingRequestDTO {
  reason?: string;
}

export interface AvailabilityRequestDTO {
  barberId: EntityId;
  serviceId: EntityId;
  date: string; // YYYY-MM-DD
  preferredTime?: string; // HH:MM
}

export interface AvailabilityResponseDTO {
  date: string;
  timeSlots: Array<{
    start: string;
    end: string;
    available: boolean;
    price: number;
    duration: number;
  }>;
  metadata: {
    barberId: EntityId;
    serviceId: EntityId;
    businessHours: {
      isOpen: boolean;
      start?: string;
      end?: string;
    };
  };
}

// ===========================================
// Review DTOs
// ===========================================

export interface CreateReviewRequestDTO {
  bookingId: EntityId;
  rating: number; // 1-5
  comment?: string;
  tags?: string[];
  photos?: string[];
}

export interface UpdateReviewRequestDTO {
  rating?: number;
  comment?: string;
  tags?: string[];
  photos?: string[];
  isPublic?: boolean;
}

export interface ReviewResponseDTO {
  id: EntityId;
  rating: number;
  comment?: string;
  tags: string[];
  photos: string[];
  isVerified: boolean;
  isPublic: boolean;
  barberResponse?: string;
  barberResponseAt?: string;
  createdAt: string;
  updatedAt: string;
  user: Pick<PublicUserProfile, 'firstName' | 'lastName'>;
  booking: {
    id: EntityId;
    serviceId: EntityId;
    serviceName: string;
    scheduledTime: string;
  };
}

export interface BarberReviewResponseRequestDTO {
  reviewId: EntityId;
  response: string;
}

export interface GetReviewsRequestDTO {
  barberId?: EntityId;
  userId?: EntityId;
  rating?: number;
  isPublic?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'rating_high' | 'rating_low';
}

export interface GetReviewsResponseDTO {
  reviews: ReviewResponseDTO[];
  pagination: PaginationMeta;
  summary: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
    commonTags: Array<{ tag: string; count: number }>;
  };
}

// ===========================================
// Payment DTOs
// ===========================================

export interface CreatePaymentIntentRequestDTO {
  bookingId: EntityId;
  paymentMethodId?: string;
  savePaymentMethod?: boolean;
}

export interface CreatePaymentIntentResponseDTO {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  metadata: {
    bookingId: EntityId;
    userId: EntityId;
    barberId: EntityId;
  };
}

export interface ConfirmPaymentRequestDTO {
  paymentIntentId: string;
  paymentMethodId: string;
}

export interface PaymentResponseDTO {
  id: EntityId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  refundedAmount?: number;
  refundedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestRefundRequestDTO {
  paymentId: EntityId;
  amount?: number; // partial refund
  reason: string;
}

export interface RefundResponseDTO {
  refundId: string;
  amount: number;
  status: string;
  reason: string;
  estimatedArrival?: string;
}

// ===========================================
// Analytics DTOs
// ===========================================

export interface AnalyticsRequestDTO {
  startDate: string;
  endDate: string;
  interval?: 'hour' | 'day' | 'week' | 'month';
  metrics?: string[];
  filters?: Record<string, any>;
}

export interface BookingAnalyticsResponseDTO {
  period: {
    start: string;
    end: string;
    interval: string;
  };
  overview: {
    totalBookings: number;
    totalRevenue: number;
    averageBookingValue: number;
    completionRate: number;
    cancellationRate: number;
    noShowRate: number;
    customerSatisfaction: number;
  };
  trends: Array<{
    date: string;
    bookings: number;
    revenue: number;
    completionRate: number;
  }>;
  services: Array<{
    serviceId: EntityId;
    serviceName: string;
    bookingCount: number;
    revenue: number;
    averageRating: number;
  }>;
  hours: Array<{
    hour: number;
    bookingCount: number;
    utilization: number;
  }>;
}

export interface CustomerAnalyticsResponseDTO {
  period: {
    start: string;
    end: string;
  };
  overview: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    retentionRate: number;
    averageLifetimeValue: number;
  };
  segments: Array<{
    segment: string;
    count: number;
    percentage: number;
    averageSpending: number;
  }>;
  acquisition: Array<{
    channel: string;
    customers: number;
    percentage: number;
    cost?: number;
  }>;
}

// ===========================================
// Notification DTOs
// ===========================================

export interface NotificationPreferencesRequestDTO {
  email?: boolean;
  sms?: boolean;
  push?: boolean;
  marketing?: boolean;
  reminders?: boolean;
  bookingUpdates?: boolean;
  promotions?: boolean;
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
}

export interface NotificationPreferencesResponseDTO extends NotificationPreferences {
  updatedAt: string;
}

export interface SendNotificationRequestDTO {
  templateId: string;
  recipients: Array<{
    userId: EntityId;
    email?: string;
    phone?: string;
    templateData: Record<string, any>;
  }>;
  type: 'email' | 'sms';
  scheduledAt?: string;
}

export interface SendNotificationResponseDTO {
  notificationId: EntityId;
  status: 'scheduled' | 'sent' | 'failed';
  recipientCount: number;
  estimatedDelivery?: string;
}

export interface NotificationHistoryRequestDTO {
  userId?: EntityId;
  type?: 'email' | 'sms' | 'push';
  status?: 'sent' | 'delivered' | 'failed' | 'bounced';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface NotificationHistoryResponseDTO {
  notifications: Array<{
    id: EntityId;
    type: 'email' | 'sms' | 'push';
    templateId: string;
    recipient: string;
    subject?: string;
    status: string;
    sentAt?: string;
    deliveredAt?: string;
    errorMessage?: string;
    retryCount: number;
  }>;
  pagination: PaginationMeta;
}

// ===========================================
// File Upload DTOs
// ===========================================

export interface UploadFileRequestDTO {
  file: File | Buffer;
  filename: string;
  contentType: string;
  folder?: string;
  isPublic?: boolean;
}

export interface UploadFileResponseDTO {
  url: string;
  filename: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

export interface DeleteFileRequestDTO {
  url: string;
}

export interface UploadPortfolioImagesRequestDTO {
  images: Array<{
    file: File | Buffer;
    filename: string;
    contentType: string;
    description?: string;
  }>;
}

export interface UploadPortfolioImagesResponseDTO {
  uploadedImages: Array<{
    url: string;
    filename: string;
    description?: string;
  }>;
  failedUploads: Array<{
    filename: string;
    error: string;
  }>;
}

// ===========================================
// Admin DTOs
// ===========================================

export interface AdminUserSearchRequestDTO {
  query?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  isActive?: boolean;
  registeredAfter?: string;
  registeredBefore?: string;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'name' | 'email';
}

export interface AdminUserResponseDTO extends PublicUserProfile {
  lastLogin?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  totalBookings: number;
  totalSpent: number;
  accountStatus: 'active' | 'suspended' | 'banned';
  flags: string[];
}

export interface AdminBarberSearchRequestDTO {
  query?: string;
  city?: string;
  state?: string;
  isActive?: boolean;
  minRating?: number;
  registeredAfter?: string;
  registeredBefore?: string;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'rating' | 'bookings';
}

export interface AdminBarberResponseDTO extends BarberProfileResponseDTO {
  user: AdminUserResponseDTO;
  totalBookings: number;
  totalRevenue: number;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  flags: string[];
  lastActiveAt?: string;
}

export interface AdminBookingSearchRequestDTO {
  status?: BookingStatus[];
  barberId?: EntityId;
  userId?: EntityId;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  hasIssues?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'amount' | 'status';
}

export interface AdminSystemStatsResponseDTO {
  users: {
    total: number;
    active: number;
    new: number;
    verified: number;
  };
  barbers: {
    total: number;
    active: number;
    verified: number;
    new: number;
  };
  bookings: {
    total: number;
    today: number;
    completed: number;
    cancelled: number;
    pending: number;
  };
  revenue: {
    total: number;
    today: number;
    thisMonth: number;
    growth: number;
  };
  issues: {
    openTickets: number;
    flaggedReviews: number;
    suspendedAccounts: number;
    paymentFailures: number;
  };
}

// ===========================================
// Error Response DTOs
// ===========================================

export interface ValidationErrorResponseDTO {
  success: false;
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: Array<{
      field: string;
      message: string;
      value?: any;
    }>;
  };
}

export interface AuthenticationErrorResponseDTO {
  success: false;
  error: {
    code: 'AUTHENTICATION_ERROR' | 'AUTHORIZATION_ERROR';
    message: string;
    details?: {
      requiredRole?: UserRole;
      currentRole?: UserRole;
    };
  };
}

export interface BusinessLogicErrorResponseDTO {
  success: false;
  error: {
    code: 'BUSINESS_LOGIC_ERROR' | 'CONFLICT_ERROR' | 'NOT_FOUND_ERROR';
    message: string;
    details?: any;
  };
}

export interface RateLimitErrorResponseDTO {
  success: false;
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
    details: {
      limit: number;
      windowMs: number;
      retryAfter: number;
    };
  };
}

// ===========================================
// Utility Types for DTOs
// ===========================================

export type CreateDTO<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDTO<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
export type ResponseDTO<T> = T & {
  createdAt: string;
  updatedAt: string;
};

export type PaginatedResponseDTO<T> = {
  data: T[];
  pagination: PaginationMeta;
};

export type SearchResponseDTO<T> = PaginatedResponseDTO<T> & {
  searchMetadata: {
    query?: string;
    totalResults: number;
    searchTime: number;
    appliedFilters: any;
  };
};

// Type helpers for request validation
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// API endpoint parameter types
export interface PathParams {
  [key: string]: string;
}

export interface QueryParams {
  [key: string]: string | string[] | undefined;
}

export interface RequestContext {
  user?: PublicUserProfile;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  timestamp: Date;
}

export default {
  // Export type utilities for easier use
  CreateDTO: {} as any,
  UpdateDTO: {} as any,
  ResponseDTO: {} as any,
  PaginatedResponseDTO: {} as any,
};