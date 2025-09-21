import { BookingResponseDTO } from '@/lib/api/types/api-dtos';

/**
 * Get booking status color for UI display
 */
export function getBookingStatusColor(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'PENDING':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'COMPLETED':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'CANCELLED':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'NO_SHOW':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

/**
 * Get booking status icon
 */
export function getBookingStatusIcon(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return '✅';
    case 'PENDING':
      return '⏳';
    case 'COMPLETED':
      return '✔️';
    case 'CANCELLED':
      return '❌';
    case 'NO_SHOW':
      return '👻';
    default:
      return '❓';
  }
}

/**
 * Format booking duration for display
 */
export function formatBookingDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }

  return `${hours} hr${hours > 1 ? 's' : ''} ${remainingMinutes} min`;
}

/**
 * Calculate booking end time
 */
export function getBookingEndTime(booking: BookingResponseDTO): Date {
  const startTime = new Date(booking.scheduledTime);
  const endTime = new Date(startTime.getTime() + booking.duration * 60 * 1000);
  return endTime;
}

/**
 * Check if booking is today
 */
export function isBookingToday(booking: BookingResponseDTO): boolean {
  const bookingDate = new Date(booking.scheduledTime);
  const today = new Date();
  return bookingDate.toDateString() === today.toDateString();
}

/**
 * Check if booking is upcoming
 */
export function isBookingUpcoming(booking: BookingResponseDTO): boolean {
  const bookingTime = new Date(booking.scheduledTime);
  const now = new Date();
  return bookingTime > now;
}

/**
 * Check if booking is in the past
 */
export function isBookingPast(booking: BookingResponseDTO): boolean {
  const bookingTime = new Date(booking.scheduledTime);
  const now = new Date();
  return bookingTime < now;
}

/**
 * Get time until booking
 */
export function getTimeUntilBooking(booking: BookingResponseDTO): string {
  const bookingTime = new Date(booking.scheduledTime);
  const now = new Date();
  const diffMs = bookingTime.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'Past';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }

  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  }

  return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
}

/**
 * Format booking price
 */
export function formatBookingPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

/**
 * Generate booking confirmation number
 */
export function getBookingConfirmationNumber(booking: BookingResponseDTO): string {
  const date = new Date(booking.scheduledTime);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const bookingIdShort = booking.id.slice(-6).toUpperCase();

  return `BB${year}${month}${day}-${bookingIdShort}`;
}

/**
 * Get booking reminder schedule
 */
export function getBookingReminders(booking: BookingResponseDTO): Array<{
  type: 'email' | 'sms' | 'push';
  time: Date;
  message: string;
}> {
  const bookingTime = new Date(booking.scheduledTime);
  const reminders: Array<{
    type: 'email' | 'sms' | 'push';
    time: Date;
    message: string;
  }> = [];

  // 24 hours before
  const emailReminder = new Date(bookingTime.getTime() - 24 * 60 * 60 * 1000);
  reminders.push({
    type: 'email',
    time: emailReminder,
    message: `Reminder: Your appointment with ${booking.barber.businessName} is tomorrow at ${bookingTime.toLocaleTimeString()}.`,
  });

  // 2 hours before
  const smsReminder = new Date(bookingTime.getTime() - 2 * 60 * 60 * 1000);
  reminders.push({
    type: 'sms',
    time: smsReminder,
    message: `Your appointment is in 2 hours at ${booking.barber.businessName}. Address: ${booking.barber.address}`,
  });

  // 30 minutes before
  const pushReminder = new Date(bookingTime.getTime() - 30 * 60 * 1000);
  reminders.push({
    type: 'push',
    time: pushReminder,
    message: `Your appointment starts in 30 minutes!`,
  });

  return reminders.filter(reminder => reminder.time > new Date());
}

/**
 * Check if booking can be cancelled
 */
export function canCancelBooking(booking: BookingResponseDTO): boolean {
  const bookingTime = new Date(booking.scheduledTime);
  const now = new Date();
  const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Can cancel if booking is confirmed/pending and at least 2 hours away
  return (
    (booking.status === 'CONFIRMED' || booking.status === 'PENDING_CONFIRMATION') &&
    hoursUntilBooking >= 2
  );
}

/**
 * Check if booking can be rescheduled
 */
export function canRescheduleBooking(booking: BookingResponseDTO): boolean {
  const bookingTime = new Date(booking.scheduledTime);
  const now = new Date();
  const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Can reschedule if booking is confirmed/pending and at least 4 hours away
  return (
    (booking.status === 'CONFIRMED' || booking.status === 'PENDING_CONFIRMATION') &&
    hoursUntilBooking >= 4
  );
}

/**
 * Get cancellation fee based on timing
 */
export function getCancellationFee(booking: BookingResponseDTO): number {
  const bookingTime = new Date(booking.scheduledTime);
  const now = new Date();
  const hoursUntilBooking = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  // No fee if cancelled more than 24 hours in advance
  if (hoursUntilBooking >= 24) {
    return 0;
  }

  // 50% fee if cancelled 2-24 hours in advance
  if (hoursUntilBooking >= 2) {
    return booking.totalPrice * 0.5;
  }

  // Full fee if cancelled less than 2 hours in advance
  return booking.totalPrice;
}

/**
 * Generate calendar event for booking
 */
export function generateCalendarEvent(booking: BookingResponseDTO): {
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  location: string;
} {
  const startTime = new Date(booking.scheduledTime);
  const endTime = getBookingEndTime(booking);

  return {
    title: `${booking.service.name} - ${booking.barber.businessName}`,
    description: `
Service: ${booking.service.name}
Duration: ${formatBookingDuration(booking.duration)}
Price: ${formatBookingPrice(booking.totalPrice)}
${booking.notes ? `Notes: ${booking.notes}` : ''}

Confirmation: ${getBookingConfirmationNumber(booking)}
Phone: ${booking.barber.phoneNumber}
    `.trim(),
    startTime,
    endTime,
    location: `${booking.barber.address}, ${booking.barber.city}, ${booking.barber.state} ${booking.barber.zipCode}`,
  };
}

/**
 * Calculate booking satisfaction score
 */
export function calculateBookingSatisfaction(booking: BookingResponseDTO): number | null {
  if (!booking.review) return null;

  // Base score from rating (0-100)
  let score = (booking.review.rating / 5) * 100;

  // Adjust based on on-time performance
  const scheduledTime = new Date(booking.scheduledTime);
  const completedTime = booking.completedAt ? new Date(booking.completedAt) : null;

  if (completedTime) {
    const timeDiffMinutes = Math.abs(completedTime.getTime() - scheduledTime.getTime()) / (1000 * 60);

    // Penalize for being more than 15 minutes late
    if (timeDiffMinutes > 15) {
      score -= Math.min(20, (timeDiffMinutes - 15) * 2);
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Group bookings by date
 */
export function groupBookingsByDate(bookings: BookingResponseDTO[]): Record<string, BookingResponseDTO[]> {
  return bookings.reduce((groups, booking) => {
    const date = new Date(booking.scheduledTime).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(booking);
    return groups;
  }, {} as Record<string, BookingResponseDTO[]>);
}

/**
 * Sort bookings by priority (upcoming first, then by time)
 */
export function sortBookingsByPriority(bookings: BookingResponseDTO[]): BookingResponseDTO[] {
  return [...bookings].sort((a, b) => {
    const now = new Date();
    const aTime = new Date(a.scheduledTime);
    const bTime = new Date(b.scheduledTime);

    const aUpcoming = aTime >= now;
    const bUpcoming = bTime >= now;

    // Upcoming bookings first
    if (aUpcoming && !bUpcoming) return -1;
    if (!aUpcoming && bUpcoming) return 1;

    // Then sort by time (upcoming: earliest first, past: latest first)
    if (aUpcoming) {
      return aTime.getTime() - bTime.getTime();
    } else {
      return bTime.getTime() - aTime.getTime();
    }
  });
}