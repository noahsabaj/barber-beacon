import { Booking, BookingStatus, Service, BarberProfile, User, Payment, Prisma } from '@prisma/client';
import { BookingRepository, BookingDetails } from '../repositories/BookingRepository';
import { BarberRepository } from '../repositories/BarberRepository';
import { UserRepository } from '../repositories/UserRepository';
import { CacheManager } from '../base/CacheManager';
import { MetricsCollector } from '../base/MetricsCollector';
import { NotificationService } from './NotificationService';
import {
  ValidationError,
  BusinessLogicError,
  ConflictError,
  NotFoundError
} from '../base/ApiError';

export interface CreateBookingParams {
  userId: string;
  barberId: string;
  serviceId: string;
  scheduledTime: Date;
  notes?: string;
  paymentMethodId?: string;
  reminderPreferences?: {
    email: boolean;
    sms: boolean;
    reminderTimes: number[]; // minutes before appointment
  };
}

export interface BookingWithRelations extends Booking {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'email' | 'phoneNumber'>;
  barber: Pick<BarberProfile, 'id' | 'businessName' | 'address' | 'phoneNumber'> & {
    user: Pick<User, 'firstName' | 'lastName'>;
  };
  service: Pick<Service, 'id' | 'name' | 'description' | 'duration' | 'price'>;
  payment?: Pick<Payment, 'id' | 'status' | 'amount' | 'stripePaymentId'>;
}

export interface UpdateBookingParams {
  bookingId: string;
  userId: string;
  scheduledTime?: Date;
  serviceId?: string;
  notes?: string;
  status?: BookingStatus;
}

export interface BookingSearchParams {
  userId?: string;
  barberId?: string;
  status?: BookingStatus[];
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface AvailabilityRequest {
  barberId: string;
  serviceId: string;
  preferredDate: Date;
  preferredTime?: string | undefined;
  duration?: number | undefined;
  excludeBookingId?: string | undefined; // For rescheduling
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  available: boolean;
  price: number;
  barberId: string;
  serviceId: string;
}

export interface BookingAnalytics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  totalRevenue: number;
  averageRating: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  averageAdvanceBooking: number; // days
  busyHours: Array<{ hour: number; bookingCount: number }>;
  popularServices: Array<{ serviceId: string; serviceName: string; bookingCount: number }>;
  monthlyTrends: Array<{ month: string; bookings: number; revenue: number }>;
}

export interface ReminderSchedule {
  bookingId: string;
  reminderTime: Date;
  type: 'email' | 'sms';
  sent: boolean;
}

export class BookingService {
  private readonly ADVANCE_BOOKING_LIMIT_DAYS = 90;
  private readonly MIN_ADVANCE_BOOKING_HOURS = 2;
  private readonly CANCELLATION_WINDOW_HOURS = 24;
  private readonly NO_SHOW_GRACE_PERIOD_MINUTES = 15;

  constructor(
    private bookingRepository: BookingRepository,
    private barberRepository: BarberRepository,
    private userRepository: UserRepository,
    private cacheManager: CacheManager,
    private metricsCollector: MetricsCollector,
    private notificationService: NotificationService
  ) {}

  // Create new booking with comprehensive validation
  async createBooking(params: CreateBookingParams): Promise<BookingDetails> {
    const startTime = Date.now();

    try {
      const { userId, barberId, serviceId, scheduledTime, notes, paymentMethodId, reminderPreferences } = params;

      // Validate booking timing
      await this.validateBookingTiming(scheduledTime);

      // Validate entities exist
      const [user, barber, service] = await Promise.all([
        this.userRepository.findUnique({ id: userId }),
        this.barberRepository.findUnique({ id: barberId }),
        this.getServiceById(serviceId, barberId)
      ]);

      if (!user) throw new NotFoundError('User not found');
      if (!barber) throw new NotFoundError('Barber not found');
      if (!service) throw new NotFoundError('Service not found');

      // Check availability
      const isAvailable = await this.checkDetailedAvailability({
        barberId,
        serviceId,
        preferredDate: scheduledTime,
        duration: service.duration
      });

      if (!isAvailable.available) {
        throw new ConflictError('Time slot is not available', {
          metadata: {
            conflicts: isAvailable.conflicts,
            suggestions: isAvailable.suggestions
          }
        });
      }

      // Calculate pricing
      const totalPrice = await this.calculateBookingPrice(service, scheduledTime);

      // Create booking
      const bookingData: Prisma.BookingCreateInput = {
        userId,
        customer: { connect: { id: userId } },
        barber: { connect: { id: barberId } },
        service: { connect: { id: serviceId } },
        scheduledTime,
        duration: service.duration,
        totalPrice,
        totalAmount: totalPrice,
        status: paymentMethodId ? 'PENDING_PAYMENT' : 'PENDING_CONFIRMATION',
        ...(notes?.trim() && { notes: notes.trim() }),
        // reminderPreferences not in the Booking model
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const booking = await this.bookingRepository.create(bookingData);

      // Schedule reminders if configured
      if (reminderPreferences?.reminderTimes?.length) {
        await this.scheduleReminders(booking.id, scheduledTime, reminderPreferences);
      }

      // Send confirmation notifications
      await this.sendBookingConfirmation(booking.id);

      // Record metrics
      this.metricsCollector.recordUserAction('booking_created', userId);
      this.metricsCollector.recordBatchOperation('create_booking', 1, 100, true);

      return await this.getBookingDetails(booking.id);

    } catch (error) {
      this.metricsCollector.recordError('create_booking', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('create_booking', Date.now() - startTime);
    }
  }

  // Update existing booking
  async updateBooking(params: UpdateBookingParams): Promise<BookingDetails> {
    const startTime = Date.now();

    try {
      const { bookingId, userId, scheduledTime, serviceId, notes, status } = params;

      // Get current booking
      const currentBooking = await this.bookingRepository.findUnique({ id: bookingId });
      if (!currentBooking) {
        throw new NotFoundError('Booking not found');
      }

      // Verify ownership or barber access
      if (currentBooking.userId !== userId) {
        const barber = await this.barberRepository.findFirst({ where: { userId } });
        if (!barber || barber.id !== currentBooking.barberId) {
          throw new ValidationError('Not authorized to update this booking');
        }
      }

      // Validate status transition
      if (status && !this.isValidStatusTransition(currentBooking.status, status)) {
        throw new ValidationError(`Invalid status transition from ${currentBooking.status} to ${status}`);
      }

      // Handle rescheduling
      if (scheduledTime) {
        await this.validateRescheduleRequest(currentBooking, scheduledTime);
      }

      // Handle service change
      let newService = null;
      if (serviceId && serviceId !== currentBooking.serviceId) {
        newService = await this.getServiceById(serviceId, currentBooking.barberId);
        if (!newService) {
          throw new NotFoundError('Service not found');
        }
      }

      // Check availability for changes
      if (scheduledTime || serviceId) {
        const checkTime = scheduledTime || currentBooking.scheduledTime;
        const checkServiceId = serviceId || currentBooking.serviceId;
        const duration = newService?.duration || currentBooking.duration;

        const isAvailable = await this.checkDetailedAvailability({
          barberId: currentBooking.barberId,
          serviceId: checkServiceId,
          preferredDate: checkTime,
          duration,
          excludeBookingId: bookingId
        });

        if (!isAvailable.available) {
          throw new ConflictError('New time slot is not available', {
            details: [(isAvailable as any).conflicts],
            metadata: (isAvailable as any).suggestions
          });
        }
      }

      // Calculate new pricing if service changed
      let newTotalPrice = currentBooking.totalPrice;
      if (newService) {
        newTotalPrice = await this.calculateBookingPrice(newService, scheduledTime || currentBooking.scheduledTime);
      }

      // Update booking
      const updateData: Prisma.BookingUpdateInput = {
        ...(scheduledTime && { scheduledTime }),
        ...(serviceId && {
          service: { connect: { id: serviceId } },
          duration: newService!.duration,
          totalPrice: newTotalPrice
        }),
        ...(notes !== undefined && { notes: notes?.trim() }),
        ...(status && { status }),
        updatedAt: new Date()
      };

      const updatedBooking = await this.bookingRepository.update({ id: bookingId }, updateData);

      // Handle status-specific logic
      await this.handleStatusChange(updatedBooking, currentBooking.status);

      // Update reminders if time changed
      if (scheduledTime) {
        await this.updateBookingReminders(bookingId, scheduledTime);
      }

      // Send update notifications
      await this.sendBookingUpdateNotification(bookingId, currentBooking.status, status);

      this.metricsCollector.recordUserAction('booking_updated', userId);

      return await this.getBookingDetails(bookingId);

    } catch (error) {
      this.metricsCollector.recordError('update_booking', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('update_booking', Date.now() - startTime);
    }
  }

  // Cancel booking with business rules
  async cancelBooking(bookingId: string, userId: string, reason?: string): Promise<void> {
    const startTime = Date.now();

    try {
      const booking = await this.bookingRepository.findUnique({ id: bookingId });
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      // Verify ownership
      if (booking.userId !== userId) {
        throw new ValidationError('Not authorized to cancel this booking');
      }

      // Check cancellation timing
      const hoursUntilAppointment = (booking.scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilAppointment < this.CANCELLATION_WINDOW_HOURS) {
        throw new BusinessLogicError(`Cancellations must be made at least ${this.CANCELLATION_WINDOW_HOURS} hours in advance`);
      }

      // Check if booking can be cancelled
      if (!['PENDING_CONFIRMATION', 'CONFIRMED', 'PENDING_PAYMENT'].includes(booking.status)) {
        throw new ValidationError('Booking cannot be cancelled in its current status');
      }

      // Update booking status
      await this.bookingRepository.update({ id: bookingId }, {
        status: 'CANCELLED',
        ...(reason && { cancellationReason: reason }),
        cancelledAt: new Date(),
        updatedAt: new Date()
      });

      // Process refund if payment was made
      if (booking.status !== 'PENDING_PAYMENT') {
        await this.processRefund(bookingId);
      }

      // Cancel reminders
      await this.cancelBookingReminders(bookingId);

      // Send cancellation notifications
      await this.sendCancellationNotification(bookingId);

      // Record metrics
      this.metricsCollector.recordUserAction('booking_cancelled', userId);

    } catch (error) {
      this.metricsCollector.recordError('cancel_booking', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('cancel_booking', Date.now() - startTime);
    }
  }

  // Get detailed availability for a specific request
  async getAvailability(request: AvailabilityRequest): Promise<AvailabilitySlot[]> {
    const startTime = Date.now();

    try {
      const { barberId, serviceId, preferredDate, duration } = request;

      // Get service details
      const service = await this.getServiceById(serviceId, barberId);
      if (!service) {
        throw new NotFoundError('Service not found');
      }

      // Check barber availability for the date
      const timeSlots = await this.barberRepository.checkAvailability({
        barberId,
        date: preferredDate,
        serviceId,
        duration: duration || service.duration
      });

      // Convert to availability slots with pricing
      const availabilitySlots: AvailabilitySlot[] = timeSlots.map(slot => ({
        start: slot.start,
        end: slot.end,
        available: slot.available,
        price: service.price,
        barberId,
        serviceId
      }));

      // Cache results for performance
      const cacheKey = `availability:${barberId}:${serviceId}:${preferredDate.toDateString()}`;
      await this.cacheManager.set(cacheKey, availabilitySlots, 300); // 5 minutes

      return availabilitySlots;

    } catch (error) {
      this.metricsCollector.recordError('get_availability', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('get_availability', Date.now() - startTime);
    }
  }

  // Search bookings with filtering
  async searchBookings(params: BookingSearchParams): Promise<{
    bookings: BookingDetails[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const startTime = Date.now();

    try {
      const { userId, barberId, status, startDate, endDate, page = 1, limit = 20 } = params;

      const whereClause: any = {};
      if (userId) whereClause.userId = userId;
      if (barberId) whereClause.barberId = barberId;
      if (status) whereClause.status = { in: status };
      if (startDate && endDate) {
        whereClause.scheduledTime = {
          gte: startDate,
          lte: endDate
        };
      }

      const bookings = await this.bookingRepository.findMany({
        where: whereClause,
        include: {
          customer: true,
          barber: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          service: true,
          payment: true,
          review: true
        }
      });

      const bookingDetails = await Promise.all(
        bookings.map((booking: any) => this.enrichBookingWithDetails(booking))
      );

      const total = await this.bookingRepository.count(whereClause);
      const totalPages = Math.ceil(total / limit);

      return {
        bookings: bookingDetails,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      };

    } catch (error) {
      this.metricsCollector.recordError('search_bookings', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('search_bookings', Date.now() - startTime);
    }
  }

  // Get comprehensive booking analytics
  async getBookingAnalytics(barberId: string, periodDays: number = 30): Promise<BookingAnalytics> {
    const startTime = Date.now();

    try {
      const cacheKey = `booking_analytics:${barberId}:${periodDays}`;
      const cached = await this.cacheManager.get<BookingAnalytics>(cacheKey);

      if (cached) {
        this.metricsCollector.recordCacheHit('booking_analytics');
        return cached;
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (periodDays * 24 * 60 * 60 * 1000));

      // Get booking statistics
      const bookingStats = await this.bookingRepository.getBookingStatistics({
        barberId,
        dateFrom: startDate,
        dateTo: endDate
      });

      // Calculate derived metrics
      const totalBookings = bookingStats.totalBookings;
      const completedBookings = bookingStats.bookingsByStatus['COMPLETED'] || 0;
      const cancelledBookings = bookingStats.bookingsByStatus['CANCELLED'] || 0;
      const noShowBookings = bookingStats.bookingsByStatus['NO_SHOW'] || 0;
      const completionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
      const cancellationRate = totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0;
      const noShowRate = totalBookings > 0 ? (noShowBookings / totalBookings) * 100 : 0;

      const analytics: BookingAnalytics = {
        totalBookings,
        completedBookings,
        cancelledBookings,
        noShowBookings,
        totalRevenue: bookingStats.totalRevenue,
        averageRating: 0, // TODO: Calculate from reviews
        completionRate,
        cancellationRate,
        noShowRate,
        averageAdvanceBooking: 0, // TODO: Calculate average days in advance
        busyHours: bookingStats.peakHours.map(ph => ({
          hour: ph.hour,
          bookingCount: ph.bookingCount
        })),
        popularServices: bookingStats.popularServices,
        monthlyTrends: bookingStats.monthlyTrends.map(trend => ({
          month: trend.month,
          bookings: trend.bookings,
          revenue: trend.revenue
        }))
      };

      // Cache for 1 hour
      await this.cacheManager.set(cacheKey, analytics, 3600);
      this.metricsCollector.recordCacheMiss('booking_analytics');

      return analytics;

    } catch (error) {
      this.metricsCollector.recordError('get_booking_analytics', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('get_booking_analytics', Date.now() - startTime);
    }
  }

  // Process no-shows automatically
  async processNoShows(): Promise<void> {
    const startTime = Date.now();

    try {
      const graceEndTime = new Date(Date.now() - (this.NO_SHOW_GRACE_PERIOD_MINUTES * 60 * 1000));

      const noShowBookings = await this.bookingRepository.findMany({
        where: {
          scheduledTime: { lte: graceEndTime },
          status: 'CONFIRMED'
        }
      });

      for (const booking of noShowBookings) {
        await this.bookingRepository.update({ id: booking.id }, {
          status: 'NO_SHOW',
          updatedAt: new Date()
        });

        // Send no-show notification
        await this.sendNoShowNotification(booking.id);

        // Apply no-show penalty if configured
        await this.applyNoShowPenalty(booking.userId);
      }

      this.metricsCollector.recordBatchOperation('process_no_shows', noShowBookings.length, Date.now() - startTime, true);

    } catch (error) {
      this.metricsCollector.recordError('process_no_shows', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('process_no_shows', Date.now() - startTime);
    }
  }

  // Send scheduled reminders
  async sendScheduledReminders(): Promise<void> {
    const startTime = Date.now();

    try {
      const now = new Date();
      const reminderWindow = new Date(now.getTime() + (5 * 60 * 1000)); // 5 minutes from now

      const dueReminders = await this.getDueReminders(now, reminderWindow);

      for (const reminder of dueReminders) {
        await this.sendReminder(reminder);
        await this.markReminderSent(reminder.bookingId, reminder.type, reminder.reminderTime);
      }

      this.metricsCollector.recordBatchOperation('send_reminders', dueReminders.length, Date.now() - startTime, true);

    } catch (error) {
      this.metricsCollector.recordError('send_scheduled_reminders', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_scheduled_reminders', Date.now() - startTime);
    }
  }

  // Private helper methods

  private async validateBookingTiming(scheduledTime: Date): Promise<void> {
    const now = new Date();
    const hoursFromNow = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const daysFromNow = hoursFromNow / 24;

    if (scheduledTime <= now) {
      throw new ValidationError('Booking time must be in the future');
    }

    if (hoursFromNow < this.MIN_ADVANCE_BOOKING_HOURS) {
      throw new ValidationError(`Bookings must be made at least ${this.MIN_ADVANCE_BOOKING_HOURS} hours in advance`);
    }

    if (daysFromNow > this.ADVANCE_BOOKING_LIMIT_DAYS) {
      throw new ValidationError(`Bookings cannot be made more than ${this.ADVANCE_BOOKING_LIMIT_DAYS} days in advance`);
    }
  }

  private async getServiceById(serviceId: string, barberId: string): Promise<Service | null> {
    // Use barberRepository to find service belonging to a specific barber
    const barber = await this.barberRepository.findUnique(
      { id: barberId },
      { include: { services: { where: { id: serviceId } } } }
    ) as any;
    return barber?.services?.[0] || null;
  }

  private async checkDetailedAvailability(request: AvailabilityRequest): Promise<{
    available: boolean;
    conflicts?: any[];
    suggestions?: AvailabilitySlot[];
  }> {
    const availability = await this.barberRepository.checkAvailability({
      barberId: request.barberId,
      date: request.preferredDate,
      serviceId: request.serviceId,
      ...(request.duration !== undefined && { duration: request.duration })
    });

    const requestedSlot = availability.find(slot =>
      slot.start <= request.preferredDate && slot.end > request.preferredDate
    );

    if (!requestedSlot || !requestedSlot.available) {
      const suggestions = availability.filter(slot => slot.available).slice(0, 5);
      return {
        available: false,
        suggestions: suggestions.map(slot => ({
          start: slot.start,
          end: slot.end,
          available: true,
          price: 0, // Will be calculated later
          barberId: request.barberId,
          serviceId: request.serviceId
        }))
      };
    }

    return { available: true };
  }

  private async calculateBookingPrice(service: Service, scheduledTime: Date): Promise<number> {
    // Base price
    let price = service.price;

    // Apply time-based pricing if configured
    const hour = scheduledTime.getHours();
    if (hour >= 18 || hour <= 8) {
      price *= 1.2; // 20% evening/early morning surcharge
    }

    // Apply weekend pricing if configured
    const dayOfWeek = scheduledTime.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      price *= 1.15; // 15% weekend surcharge
    }

    return Math.round(price * 100) / 100; // Round to 2 decimal places
  }

  private isValidStatusTransition(currentStatus: BookingStatus, newStatus: BookingStatus): boolean {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      'PENDING_CONFIRMATION': ['CONFIRMED', 'CANCELLED'],
      'PENDING_PAYMENT': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
      'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [], // Cannot transition from completed
      'CANCELLED': [], // Cannot transition from cancelled
      'NO_SHOW': [] // Cannot transition from no-show
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  private async validateRescheduleRequest(booking: Booking, newTime: Date): Promise<void> {
    const hoursUntilOriginal = (booking.scheduledTime.getTime() - Date.now()) / (1000 * 60 * 60);
    const hoursUntilNew = (newTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilOriginal < this.CANCELLATION_WINDOW_HOURS) {
      throw new BusinessLogicError('Cannot reschedule within 24 hours of appointment');
    }

    if (hoursUntilNew < this.MIN_ADVANCE_BOOKING_HOURS) {
      throw new ValidationError('New appointment time must be at least 2 hours from now');
    }
  }

  private async handleStatusChange(booking: Booking, _previousStatus: BookingStatus): Promise<void> {
    switch (booking.status) {
      case 'CONFIRMED':
        await this.handleBookingConfirmed(booking);
        break;
      case 'COMPLETED':
        await this.handleBookingCompleted(booking);
        break;
      case 'CANCELLED':
        await this.handleBookingCancelled(booking);
        break;
      case 'NO_SHOW':
        await this.handleBookingNoShow(booking);
        break;
    }
  }

  private async handleBookingConfirmed(booking: Booking): Promise<void> {
    // Send confirmation notification
    await this.notificationService.sendBookingConfirmed(booking.id);

    // Schedule reminders
    await this.scheduleDefaultReminders(booking.id, booking.scheduledTime);
  }

  private async handleBookingCompleted(booking: Booking): Promise<void> {
    // Send completion notification with review request
    await this.notificationService.sendBookingCompleted(booking.id);
  }

  private async handleBookingCancelled(booking: Booking): Promise<void> {
    // Process refund if applicable
    await this.processRefund(booking.id);
  }

  private async handleBookingNoShow(booking: Booking): Promise<void> {
    // Apply penalties and send notification
    await this.applyNoShowPenalty(booking.userId);
  }

  private async getBookingDetails(bookingId: string): Promise<BookingDetails> {
    const booking = await this.bookingRepository.findBookingWithDetails(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    return this.enrichBookingWithDetails(booking);
  }

  private async enrichBookingWithDetails(booking: BookingDetails): Promise<BookingDetails> {
    // This would normally fetch additional details and format the response
    return booking;
  }

  private async scheduleReminders(_bookingId: string, _scheduledTime: Date, _preferences: any): Promise<void> {
    // Implementation for scheduling custom reminders
  }

  private async scheduleDefaultReminders(bookingId: string, scheduledTime: Date): Promise<void> {
    // Schedule default reminders (24h, 2h before)
    const reminderTimes = [24 * 60, 2 * 60]; // 24 hours and 2 hours in minutes

    for (const minutes of reminderTimes) {
      const reminderTime = new Date(scheduledTime.getTime() - (minutes * 60 * 1000));
      if (reminderTime > new Date()) {
        await this.cacheManager.set(
          `reminder:${bookingId}:${reminderTime.getTime()}`,
          { bookingId, type: 'both', reminderTime },
          Math.floor((reminderTime.getTime() - Date.now()) / 1000)
        );
      }
    }
  }

  private async updateBookingReminders(bookingId: string, newScheduledTime: Date): Promise<void> {
    // Cancel existing reminders and schedule new ones
    await this.cancelBookingReminders(bookingId);
    await this.scheduleDefaultReminders(bookingId, newScheduledTime);
  }

  private async cancelBookingReminders(bookingId: string): Promise<void> {
    // Remove all reminders for this booking
    await this.cacheManager.invalidatePattern(`reminder:${bookingId}:*`);
  }

  private async sendBookingConfirmation(bookingId: string): Promise<void> {
    await this.notificationService.sendBookingConfirmed(bookingId);
  }

  private async sendBookingUpdateNotification(bookingId: string, oldStatus?: BookingStatus, newStatus?: BookingStatus): Promise<void> {
    if (newStatus && oldStatus !== newStatus) {
      await this.notificationService.sendBookingStatusUpdate(bookingId, newStatus);
    }
  }

  private async sendCancellationNotification(bookingId: string): Promise<void> {
    await this.notificationService.sendBookingCancelled(bookingId);
  }

  private async sendNoShowNotification(bookingId: string): Promise<void> {
    await this.notificationService.sendBookingNoShow(bookingId);
  }

  private async processRefund(_bookingId: string): Promise<void> {
    // Implementation for processing refunds through payment provider
  }

  private async applyNoShowPenalty(_userId: string): Promise<void> {
    // Implementation for applying no-show penalties
  }

  private async getDueReminders(_startTime: Date, _endTime: Date): Promise<ReminderSchedule[]> {
    // Implementation for getting due reminders from cache/database
    return [];
  }

  private async sendReminder(_reminder: ReminderSchedule): Promise<void> {
    // Implementation for sending individual reminders
  }

  private async markReminderSent(_bookingId: string, _type: string, _reminderTime: Date): Promise<void> {
    // Implementation for marking reminders as sent
  }
}