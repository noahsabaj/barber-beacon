import type {
  UserRole,
  BookingStatus,
  PaymentStatus
} from '@prisma/client';

// ===========================================
// Base Entity Types
// ===========================================

export type EntityId = string;
export type Timestamp = Date;

export interface BaseEntity {
  id: EntityId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===========================================
// User Domain Types
// ===========================================

export interface UserEntity extends BaseEntity {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phoneNumber?: string | null;
  isEmailVerified: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpiry?: Timestamp | null;
  passwordResetToken?: string | null;
  passwordResetExpiry?: Timestamp | null;
  lastLogin?: Timestamp | null;
  lastPasswordChange?: Timestamp | null;
  emailNotifications: boolean;
  smsNotifications: boolean;
  acceptedTerms: boolean;
  marketingConsent: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string | null;
}

export interface PublicUserProfile {
  id: EntityId;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: UserRole;
  isEmailVerified: boolean;
  phoneNumber?: string | null;
  createdAt: Timestamp;
}

export interface UserSecurityProfile extends PublicUserProfile {
  lastLogin?: Timestamp | null;
  lastPasswordChange?: Timestamp | null;
  twoFactorEnabled: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

// ===========================================
// Barber Domain Types
// ===========================================

export interface BusinessHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface DaySchedule {
  isOpen: boolean;
  start?: string; // HH:MM format
  end?: string; // HH:MM format
  breaks?: Array<{
    start: string;
    end: string;
    description?: string;
  }>;
}

export interface BarberProfileEntity extends BaseEntity {
  userId: EntityId;
  businessName: string;
  description?: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phoneNumber: string;
  website?: string | null;
  instagramHandle?: string | null;
  portfolioImages: string[];
  businessHours: BusinessHours;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  rating: number;
  reviewCount: number;
  businessLicense?: string | null;
  insuranceInfo?: string | null;
  specialties: string[];
  amenities: string[];
}

export interface BarberProfileSummary {
  id: EntityId;
  businessName: string;
  address: string;
  city: string;
  state: string;
  rating: number;
  reviewCount: number;
  distance?: number;
  portfolioImages: string[];
  specialties: string[];
  phoneNumber?: string;
  website?: string;
  instagramHandle?: string;
  description?: string;
  amenities: string[];
  zipCode?: string;
  businessHours?: BusinessHours;
}

export interface BarberProfileDetails extends BarberProfileEntity {
  user: PublicUserProfile;
  services: ServiceEntity[];
  reviews: ReviewWithUser[];
  isOnline?: boolean;
  nextAvailableSlot?: Timestamp;
}

// ===========================================
// Service Domain Types
// ===========================================

export interface ServiceEntity extends BaseEntity {
  barberId: EntityId;
  name: string;
  description?: string | null;
  duration: number; // minutes
  price: number; // in cents
  type: string;
  isActive: boolean;
  category: string;
  tags: string[];
  requirements?: string | null;
  preparation?: string | null;
}

export interface ServiceWithBarber extends ServiceEntity {
  barber: BarberProfileSummary;
}

export interface ServiceAvailability {
  serviceId: EntityId;
  available: boolean;
  nextAvailable?: Timestamp;
  price: number;
  estimatedDuration: number;
}

// ===========================================
// Booking Domain Types
// ===========================================

export interface BookingEntity extends BaseEntity {
  userId: EntityId;
  barberId: EntityId;
  serviceId: EntityId;
  scheduledTime: Timestamp;
  duration: number; // minutes
  totalPrice: number; // in cents
  status: BookingStatus;
  notes?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  reminderPreferences?: ReminderPreferences | null;
}

export interface ReminderPreferences {
  email: boolean;
  sms: boolean;
  reminderTimes: number[]; // minutes before appointment
}

export interface BookingWithDetails extends BookingEntity {
  user: PublicUserProfile;
  barber: BarberProfileSummary & {
    user: Pick<PublicUserProfile, 'firstName' | 'lastName'>;
  };
  service: ServiceEntity;
  payment?: PaymentEntity;
  review?: ReviewEntity;
}

export interface BookingConflict {
  bookingId: EntityId;
  conflictStart: Timestamp;
  conflictEnd: Timestamp;
  severity: 'blocking' | 'overlap' | 'adjacent';
}

export interface TimeSlot {
  start: Timestamp;
  end: Timestamp;
  available: boolean;
  price?: number;
  bookingId?: EntityId;
  conflictReason?: string;
}

// ===========================================
// Review Domain Types
// ===========================================

export interface ReviewEntity extends BaseEntity {
  userId: EntityId;
  barberId: EntityId;
  bookingId: EntityId;
  rating: number; // 1-5
  comment?: string | null;
  isVerified: boolean;
  isPublic: boolean;
  tags: string[];
  photos?: string[];
  barberResponse?: string | null;
  barberResponseAt?: Timestamp | null;
}

export interface ReviewWithUser extends ReviewEntity {
  user: Pick<PublicUserProfile, 'firstName' | 'lastName'>;
  booking: Pick<BookingEntity, 'id' | 'serviceId' | 'scheduledTime'>;
}

export interface ReviewSummary {
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>; // rating -> count
  commonTags: Array<{ tag: string; count: number }>;
  recentReviews: ReviewWithUser[];
}

// ===========================================
// Payment Domain Types
// ===========================================

export interface PaymentEntity extends BaseEntity {
  bookingId: EntityId;
  amount: number; // in cents
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  refundedAmount?: number | null;
  refundedAt?: Timestamp | null;
  failureReason?: string | null;
  metadata?: Record<string, any>;
}

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  paymentId: EntityId;
  amount?: number; // partial refund amount, if not provided, full refund
  reason: string;
  metadata?: Record<string, any>;
}

// ===========================================
// Location and Geography Types
// ===========================================

export interface Location {
  latitude: number;
  longitude: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}

export interface AddressWithCoordinates extends Address {
  latitude?: number;
  longitude?: number;
}

export interface GeoSearchParams {
  location: Location;
  radius: number; // in kilometers
  bounds?: {
    northeast: Location;
    southwest: Location;
  };
}

export interface DistanceInfo {
  distance: number; // in kilometers
  duration?: number; // estimated travel time in minutes
  unit: 'km' | 'miles';
}

// ===========================================
// Search and Filter Types
// ===========================================

export interface SearchFilters {
  query?: string;
  location?: Location;
  radius?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  serviceTypes?: string[];
  rating?: number;
  availability?: {
    date: string; // YYYY-MM-DD
    time?: string; // HH:MM
    duration?: number;
  };
  amenities?: string[];
  specialties?: string[];
  sortBy?: 'distance' | 'rating' | 'price' | 'availability' | 'newest';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalPages: number;
}

export interface SearchMetadata {
  query?: string;
  appliedFilters: SearchFilters;
  searchTime: number; // milliseconds
  resultsCount: number;
  suggestions?: string[];
}

// ===========================================
// Analytics and Metrics Types
// ===========================================

export interface AnalyticsPeriod {
  start: Timestamp;
  end: Timestamp;
  interval: 'hour' | 'day' | 'week' | 'month' | 'year';
}

export interface BookingAnalytics {
  period: AnalyticsPeriod;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  customerSatisfaction: number;
  repeatCustomerRate: number;
  bookingTrends: Array<{
    date: string;
    bookings: number;
    revenue: number;
  }>;
  popularServices: Array<{
    serviceId: EntityId;
    serviceName: string;
    bookingCount: number;
    revenue: number;
  }>;
  busyHours: Array<{
    hour: number;
    bookingCount: number;
    utilization: number;
  }>;
}

export interface UserAnalytics {
  period: AnalyticsPeriod;
  newUsers: number;
  activeUsers: number;
  retentionRate: number;
  averageSessionDuration: number;
  bounceRate: number;
  conversionRate: number;
  userSegments: Array<{
    segment: string;
    count: number;
    percentage: number;
  }>;
  acquisitionChannels: Array<{
    channel: string;
    users: number;
    percentage: number;
  }>;
}

export interface BarberAnalytics {
  period: AnalyticsPeriod;
  barberId: EntityId;
  totalBookings: number;
  revenue: number;
  averageRating: number;
  utilizationRate: number;
  customerRetention: number;
  profileViews: number;
  conversionRate: number;
  averageServiceTime: number;
  noShowRate: number;
  cancellationRate: number;
}

// ===========================================
// Notification Types
// ===========================================

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  marketing: boolean;
  reminders: boolean;
  bookingUpdates: boolean;
  promotions: boolean;
  systemAlerts: boolean;
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM
    end: string; // HH:MM
    timezone: string;
  };
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  category: string;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
  version: number;
}

export interface NotificationEvent {
  id: EntityId;
  type: string;
  recipientId: EntityId;
  templateId: string;
  channel: 'email' | 'sms' | 'push';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  scheduledAt?: Timestamp;
  sentAt?: Timestamp;
  deliveredAt?: Timestamp;
  errorMessage?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

// ===========================================
// API Response Types
// ===========================================

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: PaginationMeta;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// ===========================================
// Utility Types
// ===========================================

export type EntityWithoutTimestamps<T extends BaseEntity> = Omit<T, 'createdAt' | 'updatedAt'>;
export type EntityCreateInput<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type EntityUpdateInput<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt'>>;

export type PublicEntity<T> = Omit<T, 'passwordHash' | 'emailVerificationToken' | 'passwordResetToken' | 'twoFactorSecret'>;

export type OptionalExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;
export type RequiredExcept<T, K extends keyof T> = Required<T> & Partial<Pick<T, K>>;

// ===========================================
// Domain Events
// ===========================================

export interface DomainEvent {
  id: EntityId;
  type: string;
  aggregateId: EntityId;
  aggregateType: string;
  version: number;
  occurredAt: Timestamp;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UserRegisteredEvent extends DomainEvent {
  type: 'user.registered';
  data: {
    userId: EntityId;
    email: string;
    role: UserRole;
  };
}

export interface BookingCreatedEvent extends DomainEvent {
  type: 'booking.created';
  data: {
    bookingId: EntityId;
    userId: EntityId;
    barberId: EntityId;
    serviceId: EntityId;
    scheduledTime: Timestamp;
    totalPrice: number;
  };
}

export interface BookingStatusChangedEvent extends DomainEvent {
  type: 'booking.status_changed';
  data: {
    bookingId: EntityId;
    oldStatus: BookingStatus;
    newStatus: BookingStatus;
    changedBy: EntityId;
    reason?: string;
  };
}

export interface PaymentCompletedEvent extends DomainEvent {
  type: 'payment.completed';
  data: {
    paymentId: EntityId;
    bookingId: EntityId;
    amount: number;
    paymentMethod: string;
  };
}

export interface ReviewCreatedEvent extends DomainEvent {
  type: 'review.created';
  data: {
    reviewId: EntityId;
    bookingId: EntityId;
    barberId: EntityId;
    rating: number;
  };
}

// ===========================================
// Type Guards
// ===========================================

export function isUser(entity: any): entity is UserEntity {
  return entity && typeof entity.email === 'string' && typeof entity.role === 'string';
}

export function isBarberProfile(entity: any): entity is BarberProfileEntity {
  return entity && typeof entity.businessName === 'string' && typeof entity.userId === 'string';
}

export function isBooking(entity: any): entity is BookingEntity {
  return entity && typeof entity.userId === 'string' && typeof entity.barberId === 'string' && entity.scheduledTime instanceof Date;
}

export function isService(entity: any): entity is ServiceEntity {
  return entity && typeof entity.name === 'string' && typeof entity.price === 'number' && typeof entity.duration === 'number';
}

export function isReview(entity: any): entity is ReviewEntity {
  return entity && typeof entity.rating === 'number' && typeof entity.userId === 'string' && typeof entity.barberId === 'string';
}

export function isPayment(entity: any): entity is PaymentEntity {
  return entity && typeof entity.amount === 'number' && typeof entity.status === 'string' && typeof entity.bookingId === 'string';
}

// ===========================================
// Mapped Types for Transformations
// ===========================================

export type UserEntityToPublic = (user: UserEntity) => PublicUserProfile;
export type BarberProfileToSummary = (profile: BarberProfileEntity) => BarberProfileSummary;
export type BookingToWithDetails = (booking: BookingEntity, includes: any) => BookingWithDetails;

// Helper type for database include options
export type IncludeOptions<T> = {
  [K in keyof T]?: boolean | object;
};

// Type for pagination queries
export interface PaginationQuery {
  page?: number;
  limit?: number;
  offset?: number;
}

// Type for sorting queries
export interface SortQuery<T> {
  field: keyof T;
  direction: 'asc' | 'desc';
}

// Combined query type
export interface DatabaseQuery<T> extends PaginationQuery {
  where?: Partial<T>;
  include?: IncludeOptions<T>;
  sort?: SortQuery<T>[];
}

export default {
  // Export all types as a module for easier imports
  User: {} as UserEntity,
  BarberProfile: {} as BarberProfileEntity,
  Service: {} as ServiceEntity,
  Booking: {} as BookingEntity,
  Review: {} as ReviewEntity,
  Payment: {} as PaymentEntity,
};