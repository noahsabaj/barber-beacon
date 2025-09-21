import { BookingStatus } from '@prisma/client';
import { CacheManager } from '../base/CacheManager';
import { MetricsCollector } from '../base/MetricsCollector';
import { UserRepository } from '../repositories/UserRepository';
import { BookingRepository } from '../repositories/BookingRepository';
import { BarberRepository } from '../repositories/BarberRepository';
import {
  BusinessLogicError,
  NotFoundError
} from '../base/ApiError';

// Email provider interface
interface EmailProvider {
  sendEmail(params: EmailParams): Promise<EmailResult>;
  sendBulkEmail(emails: EmailParams[]): Promise<EmailResult[]>;
}

// SMS provider interface
interface SMSProvider {
  sendSMS(params: SMSParams): Promise<SMSResult>;
  sendBulkSMS(messages: SMSParams[]): Promise<SMSResult[]>;
}

export interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    type?: string;
  }>;
}

export interface SMSParams {
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
}

export interface EmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending: string[];
}

export interface SMSResult {
  messageId: string;
  status: 'sent' | 'failed' | 'pending';
  errorMessage?: string;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  emailTypes: string[];
  smsTypes: string[];
  pushTypes: string[];
  timezone: string;
  language: string;
  quietHours?: {
    start: string;
    end: string;
  };
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push';
  subject?: string;
  body: string;
  variables: string[];
  category: string;
  isActive: boolean;
}

export interface NotificationLog {
  id: string;
  userId: string;
  type: 'email' | 'sms' | 'push';
  templateId: string;
  recipient: string;
  subject?: string;
  body: string;
  status: 'sent' | 'failed' | 'pending' | 'delivered' | 'bounced';
  sentAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

export interface BulkNotificationRequest {
  templateId: string;
  recipients: Array<{
    userId: string;
    email?: string;
    phone?: string;
    templateData: Record<string, any>;
  }>;
  type: 'email' | 'sms';
  scheduledAt?: Date;
}

export class NotificationService {
  private readonly RATE_LIMIT_PER_MINUTE = 100;
  private readonly QUIET_HOURS_DEFAULT = { start: '22:00', end: '07:00' };

  private emailProvider: EmailProvider;
  private smsProvider: SMSProvider;

  constructor(
    private userRepository: UserRepository,
    private bookingRepository: BookingRepository,
    _barberRepository: BarberRepository,
    private cacheManager: CacheManager,
    private metricsCollector: MetricsCollector
  ) {
    this.emailProvider = new SendGridProvider();
    this.smsProvider = new TwilioProvider();
  }

  // Authentication-related notifications
  async sendEmailVerification(email: string, firstName: string, token: string): Promise<void> {
    const startTime = Date.now();

    try {
      const templateData = {
        firstName,
        verificationUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/auth/verify-email?token=${token}`,
        expiryHours: 24
      };

      await this.sendEmailNotification({
        to: email,
        templateId: 'email-verification',
        templateData,
        category: 'authentication'
      });

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'verification' });

    } catch (error) {
      this.metricsCollector.recordError('send_email_verification', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_email_verification', Date.now() - startTime);
    }
  }

  async sendPasswordReset(email: string, firstName: string, token: string): Promise<void> {
    const startTime = Date.now();

    try {
      const templateData = {
        firstName,
        resetUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/auth/reset-password?token=${token}`,
        expiryHours: 1
      };

      await this.sendEmailNotification({
        to: email,
        templateId: 'password-reset',
        templateData,
        category: 'authentication'
      });

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'password-reset' });

    } catch (error) {
      this.metricsCollector.recordError('send_password_reset', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_password_reset', Date.now() - startTime);
    }
  }

  async sendPasswordChangeConfirmation(email: string, firstName: string): Promise<void> {
    const startTime = Date.now();

    try {
      const templateData = {
        firstName,
        changeTime: new Date().toLocaleString(),
        supportUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/support`
      };

      await this.sendEmailNotification({
        to: email,
        templateId: 'password-changed',
        templateData,
        category: 'security'
      });

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'password-changed' });

    } catch (error) {
      this.metricsCollector.recordError('send_password_change_confirmation', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_password_change_confirmation', Date.now() - startTime);
    }
  }

  async sendWelcome(email: string, firstName: string): Promise<void> {
    const startTime = Date.now();

    try {
      const templateData = {
        firstName,
        dashboardUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/dashboard`,
        searchUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/barbers`
      };

      await this.sendEmailNotification({
        to: email,
        templateId: 'welcome',
        templateData,
        category: 'onboarding'
      });

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'welcome' });

    } catch (error) {
      this.metricsCollector.recordError('send_welcome', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_welcome', Date.now() - startTime);
    }
  }

  // Booking-related notifications
  async sendBookingConfirmed(bookingId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const booking = await this.getBookingWithDetails(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      const templateData = {
        customerName: `${booking.user.firstName} ${booking.user.lastName}`,
        barberName: `${booking.barber.user.firstName} ${booking.barber.user.lastName}`,
        businessName: booking.barber.businessName,
        serviceName: booking.service.name,
        appointmentDate: booking.scheduledTime.toLocaleDateString(),
        appointmentTime: booking.scheduledTime.toLocaleTimeString(),
        duration: `${booking.service.duration} minutes`,
        price: `$${booking.totalPrice}`,
        address: booking.barber.address,
        phone: booking.barber.phoneNumber,
        bookingId: booking.id
      };

      // Send to customer
      await this.sendEmailNotification({
        to: booking.user.email,
        templateId: 'booking-confirmed-customer',
        templateData,
        category: 'booking'
      });

      // Send SMS reminder to customer if enabled
      if (booking.user.phoneNumber && booking.user.smsNotifications) {
        await this.sendSMSNotification({
          to: booking.user.phoneNumber,
          templateId: 'booking-confirmed-sms',
          templateData,
          category: 'booking'
        });
      }

      // Send to barber
      await this.sendEmailNotification({
        to: booking.barber.user.email,
        templateId: 'booking-confirmed-barber',
        templateData,
        category: 'booking'
      });

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'booking-confirmed' });

    } catch (error) {
      this.metricsCollector.recordError('send_booking_confirmed', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_booking_confirmed', Date.now() - startTime);
    }
  }

  async sendBookingReminder(bookingId: string, minutesBefore: number): Promise<void> {
    const startTime = Date.now();

    try {
      const booking = await this.getBookingWithDetails(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      const templateData = {
        customerName: `${booking.user.firstName} ${booking.user.lastName}`,
        barberName: `${booking.barber.user.firstName} ${booking.barber.user.lastName}`,
        businessName: booking.barber.businessName,
        serviceName: booking.service.name,
        appointmentDate: booking.scheduledTime.toLocaleDateString(),
        appointmentTime: booking.scheduledTime.toLocaleTimeString(),
        address: booking.barber.address,
        phone: booking.barber.phoneNumber,
        minutesBefore,
        bookingId: booking.id
      };

      // Send email reminder
      if (booking.user.emailNotifications) {
        await this.sendEmailNotification({
          to: booking.user.email,
          templateId: 'booking-reminder',
          templateData,
          category: 'reminder'
        });
      }

      // Send SMS reminder
      if (booking.user.phoneNumber && booking.user.smsNotifications) {
        await this.sendSMSNotification({
          to: booking.user.phoneNumber,
          templateId: 'booking-reminder-sms',
          templateData,
          category: 'reminder'
        });
      }

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'booking-reminder' });

    } catch (error) {
      this.metricsCollector.recordError('send_booking_reminder', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_booking_reminder', Date.now() - startTime);
    }
  }

  async sendBookingCancelled(bookingId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const booking = await this.getBookingWithDetails(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      const templateData = {
        customerName: `${booking.user.firstName} ${booking.user.lastName}`,
        barberName: `${booking.barber.user.firstName} ${booking.barber.user.lastName}`,
        businessName: booking.barber.businessName,
        serviceName: booking.service.name,
        originalDate: booking.scheduledTime.toLocaleDateString(),
        originalTime: booking.scheduledTime.toLocaleTimeString(),
        refundAmount: `$${booking.totalPrice}`,
        bookingId: booking.id,
        rebookUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/barbers/${booking.barberId}/book`
      };

      // Send to customer
      await this.sendEmailNotification({
        to: booking.user.email,
        templateId: 'booking-cancelled-customer',
        templateData,
        category: 'booking'
      });

      // Send to barber
      await this.sendEmailNotification({
        to: booking.barber.user.email,
        templateId: 'booking-cancelled-barber',
        templateData,
        category: 'booking'
      });

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'booking-cancelled' });

    } catch (error) {
      this.metricsCollector.recordError('send_booking_cancelled', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_booking_cancelled', Date.now() - startTime);
    }
  }

  async sendBookingCompleted(bookingId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const booking = await this.getBookingWithDetails(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      const templateData = {
        customerName: `${booking.user.firstName} ${booking.user.lastName}`,
        barberName: `${booking.barber.user.firstName} ${booking.barber.user.lastName}`,
        businessName: booking.barber.businessName,
        serviceName: booking.service.name,
        appointmentDate: booking.scheduledTime.toLocaleDateString(),
        totalPaid: `$${booking.totalPrice}`,
        reviewUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/bookings/${booking.id}/review`,
        rebookUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/barbers/${booking.barberId}/book`
      };

      // Send completion notification with review request
      await this.sendEmailNotification({
        to: booking.user.email,
        templateId: 'booking-completed',
        templateData,
        category: 'booking'
      });

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'booking-completed' });

    } catch (error) {
      this.metricsCollector.recordError('send_booking_completed', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_booking_completed', Date.now() - startTime);
    }
  }

  async sendBookingNoShow(bookingId: string): Promise<void> {
    const startTime = Date.now();

    try {
      const booking = await this.getBookingWithDetails(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      const templateData = {
        customerName: `${booking.user.firstName} ${booking.user.lastName}`,
        barberName: `${booking.barber.user.firstName} ${booking.barber.user.lastName}`,
        businessName: booking.barber.businessName,
        serviceName: booking.service.name,
        appointmentDate: booking.scheduledTime.toLocaleDateString(),
        appointmentTime: booking.scheduledTime.toLocaleTimeString(),
        penaltyAmount: `$${Math.min(booking.totalPrice * 0.5, 25)}`, // 50% or $25 max
        rebookUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/barbers/${booking.barberId}/book`
      };

      // Send to customer
      await this.sendEmailNotification({
        to: booking.user.email,
        templateId: 'booking-no-show',
        templateData,
        category: 'booking'
      });

      // Send to barber
      await this.sendEmailNotification({
        to: booking.barber.user.email,
        templateId: 'booking-no-show-barber',
        templateData,
        category: 'booking'
      });

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'booking-no-show' });

    } catch (error) {
      this.metricsCollector.recordError('send_booking_no_show', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_booking_no_show', Date.now() - startTime);
    }
  }

  async sendBookingStatusUpdate(bookingId: string, newStatus: BookingStatus): Promise<void> {
    const startTime = Date.now();

    try {
      const booking = await this.getBookingWithDetails(bookingId);
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      const statusMessages = {
        'PENDING_CONFIRMATION': 'pending confirmation',
        'PENDING_PAYMENT': 'pending payment',
        'CONFIRMED': 'confirmed',
        'IN_PROGRESS': 'in progress',
        'COMPLETED': 'completed',
        'CANCELLED': 'cancelled',
        'NO_SHOW': 'marked as no-show'
      };

      const templateData = {
        customerName: `${booking.user.firstName} ${booking.user.lastName}`,
        barberName: `${booking.barber.user.firstName} ${booking.barber.user.lastName}`,
        businessName: booking.barber.businessName,
        serviceName: booking.service.name,
        appointmentDate: booking.scheduledTime.toLocaleDateString(),
        appointmentTime: booking.scheduledTime.toLocaleTimeString(),
        status: statusMessages[newStatus],
        bookingUrl: `${process.env['NEXT_PUBLIC_APP_URL']}/bookings/${booking.id}`
      };

      await this.sendEmailNotification({
        to: booking.user.email,
        templateId: 'booking-status-update',
        templateData,
        category: 'booking'
      });

      this.metricsCollector.record('notification_sent', 1, 'count', { type: 'email', subtype: 'booking-status-update' });

    } catch (error) {
      this.metricsCollector.recordError('send_booking_status_update', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_booking_status_update', Date.now() - startTime);
    }
  }

  // Bulk notification methods
  async sendBulkNotification(request: BulkNotificationRequest): Promise<{ sent: number; failed: number }> {
    const startTime = Date.now();

    try {
      let sent = 0;
      let failed = 0;

      const batchSize = 50; // Process in batches to avoid overwhelming providers
      const batches = this.chunkArray(request.recipients, batchSize);

      for (const batch of batches) {
        const notifications = batch.map(recipient => {
          if (request.type === 'email' && recipient.email) {
            return this.sendEmailNotification({
              to: recipient.email,
              templateId: request.templateId,
              templateData: recipient.templateData,
              category: 'bulk'
            });
          } else if (request.type === 'sms' && recipient.phone) {
            return this.sendSMSNotification({
              to: recipient.phone,
              templateId: request.templateId,
              templateData: recipient.templateData,
              category: 'bulk'
            });
          }
          return Promise.reject(new Error('Invalid recipient data'));
        });

        const results = await Promise.allSettled(notifications);

        results.forEach(result => {
          if (result.status === 'fulfilled') {
            sent++;
          } else {
            failed++;
          }
        });

        // Rate limiting between batches
        await this.sleep(1000);
      }

      this.metricsCollector.recordBatchOperation('bulk_notification', sent + failed, Date.now() - startTime, failed === 0);

      return { sent, failed };

    } catch (error) {
      this.metricsCollector.recordError('send_bulk_notification', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('send_bulk_notification', Date.now() - startTime);
    }
  }

  // Notification preferences management
  async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    const startTime = Date.now();

    try {
      const cacheKey = `notification_preferences:${userId}`;
      const currentPreferences = await this.cacheManager.get(cacheKey) || this.getDefaultPreferences();

      const updatedPreferences = {
        ...currentPreferences,
        ...preferences
      };

      await this.cacheManager.set(cacheKey, updatedPreferences, 86400); // Cache for 24 hours

      // Also update in database
      await this.userRepository.updateById(userId, {
        ...(updatedPreferences.email !== undefined && { emailNotifications: updatedPreferences.email }),
        ...(updatedPreferences.sms !== undefined && { smsNotifications: updatedPreferences.sms }),
        updatedAt: new Date()
      });

      this.metricsCollector.recordUserAction('notification_preferences_updated', userId);

    } catch (error) {
      this.metricsCollector.recordError('update_notification_preferences', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('update_notification_preferences', Date.now() - startTime);
    }
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const startTime = Date.now();

    try {
      const cacheKey = `notification_preferences:${userId}`;
      let preferences = await this.cacheManager.get<NotificationPreferences>(cacheKey);

      if (!preferences) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new NotFoundError('User not found');
        }

        preferences = {
          ...this.getDefaultPreferences(),
          email: user.emailNotifications ?? true,
          sms: user.smsNotifications ?? false
        };

        await this.cacheManager.set(cacheKey, preferences, 86400);
      }

      return preferences;

    } catch (error) {
      this.metricsCollector.recordError('get_notification_preferences', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('get_notification_preferences', Date.now() - startTime);
    }
  }

  // Private helper methods
  private async sendEmailNotification(params: {
    to: string;
    templateId: string;
    templateData: Record<string, any>;
    category: string;
  }): Promise<void> {
    try {
      // Check rate limiting
      await this.checkRateLimit(params.to, 'email');

      // Get template
      const template = await this.getTemplate(params.templateId, 'email');
      if (!template) {
        throw new NotFoundError(`Email template ${params.templateId} not found`);
      }

      // Render template
      const renderedSubject = this.renderTemplate(template.subject || '', params.templateData);
      const renderedBody = this.renderTemplate(template.body, params.templateData);

      // Send email
      const result = await this.emailProvider.sendEmail({
        to: params.to,
        subject: renderedSubject,
        html: renderedBody,
        templateData: params.templateData
      });

      // Log notification
      await this.logNotification({
        userId: '', // Would be populated from params
        type: 'email',
        templateId: params.templateId,
        recipient: params.to,
        subject: renderedSubject,
        body: renderedBody,
        status: 'sent',
        sentAt: new Date(),
        retryCount: 0,
        metadata: { category: params.category, messageId: result.messageId }
      });

    } catch (error) {
      // Log failed notification
      await this.logNotification({
        userId: '',
        type: 'email',
        templateId: params.templateId,
        recipient: params.to,
        subject: '',
        body: '',
        status: 'failed',
        retryCount: 0,
        errorMessage: (error as Error).message,
        metadata: { category: params.category }
      });

      throw error;
    }
  }

  private async sendSMSNotification(params: {
    to: string;
    templateId: string;
    templateData: Record<string, any>;
    category: string;
  }): Promise<void> {
    try {
      // Check rate limiting
      await this.checkRateLimit(params.to, 'sms');

      // Get template
      const template = await this.getTemplate(params.templateId, 'sms');
      if (!template) {
        throw new NotFoundError(`SMS template ${params.templateId} not found`);
      }

      // Render template
      const renderedBody = this.renderTemplate(template.body, params.templateData);

      // Send SMS
      const result = await this.smsProvider.sendSMS({
        to: params.to,
        body: renderedBody
      });

      // Log notification
      await this.logNotification({
        userId: '',
        type: 'sms',
        templateId: params.templateId,
        recipient: params.to,
        body: renderedBody,
        status: 'sent',
        sentAt: new Date(),
        retryCount: 0,
        metadata: { category: params.category, messageId: result.messageId }
      });

    } catch (error) {
      // Log failed notification
      await this.logNotification({
        userId: '',
        type: 'sms',
        templateId: params.templateId,
        recipient: params.to,
        body: '',
        status: 'failed',
        retryCount: 0,
        errorMessage: (error as Error).message,
        metadata: { category: params.category }
      });

      throw error;
    }
  }

  private async getBookingWithDetails(bookingId: string): Promise<any> {
    return await this.bookingRepository.findBookingWithDetails(bookingId);
  }

  private async getTemplate(templateId: string, type: 'email' | 'sms'): Promise<NotificationTemplate | null> {
    const cacheKey = `template:${templateId}:${type}`;
    let template = await this.cacheManager.get<NotificationTemplate>(cacheKey);

    if (!template) {
      // In a real implementation, this would fetch from database
      template = this.getBuiltInTemplate(templateId, type);
      if (template) {
        await this.cacheManager.set(cacheKey, template, 3600); // Cache for 1 hour
      }
    }

    return template;
  }

  private getBuiltInTemplate(templateId: string, _type: 'email' | 'sms'): NotificationTemplate | null {
    // This would normally be loaded from a database or configuration
    const templates: Record<string, NotificationTemplate> = {
      'email-verification': {
        id: 'email-verification',
        name: 'Email Verification',
        type: 'email',
        subject: 'Verify your Barber Beacon account',
        body: `
          <h2>Welcome to Barber Beacon!</h2>
          <p>Hi {{firstName}},</p>
          <p>Please verify your email address by clicking the link below:</p>
          <p><a href="{{verificationUrl}}">Verify Email Address</a></p>
          <p>This link will expire in {{expiryHours}} hours.</p>
        `,
        variables: ['firstName', 'verificationUrl', 'expiryHours'],
        category: 'authentication',
        isActive: true
      },
      'booking-confirmed-customer': {
        id: 'booking-confirmed-customer',
        name: 'Booking Confirmed - Customer',
        type: 'email',
        subject: 'Your appointment is confirmed!',
        body: `
          <h2>Appointment Confirmed</h2>
          <p>Hi {{customerName}},</p>
          <p>Your appointment has been confirmed!</p>
          <div>
            <strong>Service:</strong> {{serviceName}}<br>
            <strong>Date:</strong> {{appointmentDate}}<br>
            <strong>Time:</strong> {{appointmentTime}}<br>
            <strong>Duration:</strong> {{duration}}<br>
            <strong>Price:</strong> {{price}}<br>
            <strong>Barber:</strong> {{barberName}} at {{businessName}}<br>
            <strong>Address:</strong> {{address}}<br>
            <strong>Phone:</strong> {{phone}}
          </div>
          <p>Booking ID: {{bookingId}}</p>
        `,
        variables: ['customerName', 'serviceName', 'appointmentDate', 'appointmentTime', 'duration', 'price', 'barberName', 'businessName', 'address', 'phone', 'bookingId'],
        category: 'booking',
        isActive: true
      },
      'booking-reminder-sms': {
        id: 'booking-reminder-sms',
        name: 'Booking Reminder SMS',
        type: 'sms',
        body: 'Reminder: You have an appointment with {{barberName}} in {{minutesBefore}} minutes at {{appointmentTime}}. Address: {{address}}',
        variables: ['barberName', 'minutesBefore', 'appointmentTime', 'address'],
        category: 'reminder',
        isActive: true
      }
    };

    return templates[templateId] || null;
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  private async checkRateLimit(recipient: string, type: 'email' | 'sms'): Promise<void> {
    const key = `rate_limit:${type}:${recipient}`;
    const current = await this.cacheManager.get(key) || 0;

    if (Number(current) >= this.RATE_LIMIT_PER_MINUTE) {
      throw new BusinessLogicError('Rate limit exceeded for notifications');
    }

    await this.cacheManager.set(key, Number(current) + 1, 60);
  }

  private async logNotification(log: Partial<NotificationLog>): Promise<void> {
    // In a real implementation, this would store to database
    const logEntry = {
      id: crypto.randomUUID(),
      ...log,
      timestamp: new Date()
    };

    // Store in cache for immediate retrieval
    await this.cacheManager.set(
      `notification_log:${logEntry.id}`,
      logEntry,
      86400 // 24 hours
    );
  }

  private getDefaultPreferences(): NotificationPreferences {
    return {
      email: true,
      sms: false,
      push: false,
      emailTypes: ['booking', 'reminder', 'authentication'],
      smsTypes: ['reminder'],
      pushTypes: [],
      timezone: 'UTC',
      language: 'en',
      quietHours: this.QUIET_HOURS_DEFAULT
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// SendGrid email provider implementation
class SendGridProvider implements EmailProvider {
  async sendEmail(params: EmailParams): Promise<EmailResult> {
    // Implementation would use SendGrid SDK
    // For now, return mock result
    return {
      messageId: `sg_${Date.now()}`,
      accepted: [params.to],
      rejected: [],
      pending: []
    };
  }

  async sendBulkEmail(emails: EmailParams[]): Promise<EmailResult[]> {
    return Promise.all(emails.map(email => this.sendEmail(email)));
  }
}

// Twilio SMS provider implementation
class TwilioProvider implements SMSProvider {
  async sendSMS(_params: SMSParams): Promise<SMSResult> {
    // Implementation would use Twilio SDK
    // For now, return mock result
    return {
      messageId: `tw_${Date.now()}`,
      status: 'sent'
    };
  }

  async sendBulkSMS(messages: SMSParams[]): Promise<SMSResult[]> {
    return Promise.all(messages.map(message => this.sendSMS(message)));
  }
}