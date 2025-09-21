// Booking Components
export { BookingForm } from './components/BookingForm';
export { BookingCard } from './components/BookingCard';

// Booking Hooks
export { useBookingFilters, useBookingStats, useBookingTimeSlots } from './hooks/useBookingFilters';

// Booking Utils
export {
  getBookingStatusColor,
  getBookingStatusIcon,
  formatBookingDuration,
  getBookingEndTime,
  isBookingToday,
  isBookingUpcoming,
  isBookingPast,
  getTimeUntilBooking,
  formatBookingPrice,
  getBookingConfirmationNumber,
  getBookingReminders,
  canCancelBooking,
  canRescheduleBooking,
  getCancellationFee,
  generateCalendarEvent,
  calculateBookingSatisfaction,
  groupBookingsByDate,
  sortBookingsByPriority,
} from './utils/bookingUtils';

// Re-export base booking hooks for convenience
export {
  useBookings,
  useBooking,
  useCreateBooking,
  useUpdateBooking,
  useCancelBooking,
  useBarberAvailability,
  useOptimisticBookingUpdate,
  bookingKeys,
} from '@/hooks/bookings/useBookings';