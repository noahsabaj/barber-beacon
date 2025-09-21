'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
} from 'date-fns';

interface CalendarBooking {
  id: string;
  customerId: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  barberId: string;
  barberName: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  totalPrice: number;
  notes?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  bookings: CalendarBooking[];
  availability: {
    totalSlots: number;
    bookedSlots: number;
    availableSlots: number;
  };
}

interface CalendarFilter {
  barberId?: string;
  serviceId?: string;
  status?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

type CalendarView = 'month' | 'week' | 'day' | 'agenda';

interface CalendarState {
  currentDate: Date;
  view: CalendarView;
  selectedDate: Date | null;
  selectedBooking: CalendarBooking | null;
  filters: CalendarFilter;
}

// Main booking calendar hook
export function useBookingCalendar(barberId?: string) {
  const [state, setState] = useState<CalendarState>({
    currentDate: new Date(),
    view: 'month',
    selectedDate: null,
    selectedBooking: null,
    filters: { ...(barberId !== undefined && { barberId }) },
  });

  // Calculate date range based on current view
  const dateRange = useMemo(() => {
    switch (state.view) {
      case 'month':
        return {
          start: startOfWeek(startOfMonth(state.currentDate)),
          end: endOfWeek(endOfMonth(state.currentDate)),
        };
      case 'week':
        return {
          start: startOfWeek(state.currentDate),
          end: endOfWeek(state.currentDate),
        };
      case 'day':
        return {
          start: state.currentDate,
          end: state.currentDate,
        };
      case 'agenda':
        return {
          start: state.currentDate,
          end: addDays(state.currentDate, 30), // 30 days for agenda view
        };
      default:
        return {
          start: startOfWeek(startOfMonth(state.currentDate)),
          end: endOfWeek(endOfMonth(state.currentDate)),
        };
    }
  }, [state.currentDate, state.view]);

  // Fetch bookings for the current date range
  const {
    data: bookings,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      'calendar-bookings',
      format(dateRange.start, 'yyyy-MM-dd'),
      format(dateRange.end, 'yyyy-MM-dd'),
      state.filters,
    ],
    queryFn: async (): Promise<CalendarBooking[]> => {
      const params = new URLSearchParams({
        startDate: format(dateRange.start, 'yyyy-MM-dd'),
        endDate: format(dateRange.end, 'yyyy-MM-dd'),
      });

      if (state.filters.barberId) {
        params.append('barberId', state.filters.barberId);
      }

      if (state.filters.serviceId) {
        params.append('serviceId', state.filters.serviceId);
      }

      if (state.filters.status && state.filters.status.length > 0) {
        state.filters.status.forEach(status => {
          params.append('status', status);
        });
      }

      const response = await fetch(`/api/bookings/calendar?${params}`);
      if (!response.ok) throw new Error('Failed to fetch calendar bookings');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch availability data for the date range
  const { data: availabilityData } = useQuery({
    queryKey: [
      'calendar-availability',
      format(dateRange.start, 'yyyy-MM-dd'),
      format(dateRange.end, 'yyyy-MM-dd'),
      state.filters.barberId,
    ],
    queryFn: async () => {
      if (!state.filters.barberId) return {};

      const params = new URLSearchParams({
        barberId: state.filters.barberId,
        startDate: format(dateRange.start, 'yyyy-MM-dd'),
        endDate: format(dateRange.end, 'yyyy-MM-dd'),
      });

      const response = await fetch(`/api/availability/summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch availability');
      return response.json();
    },
    enabled: !!state.filters.barberId,
  });

  // Generate calendar days with booking data
  const calendarDays = useMemo((): CalendarDay[] => {
    const days = eachDayOfInterval(dateRange);

    return days.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayBookings = bookings?.filter(booking => booking.date === dateStr) || [];
      const availability = availabilityData?.[dateStr] || {
        totalSlots: 0,
        bookedSlots: 0,
        availableSlots: 0,
      };

      return {
        date,
        isCurrentMonth: isSameMonth(date, state.currentDate),
        isToday: isToday(date),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        bookings: dayBookings,
        availability,
      };
    });
  }, [dateRange, bookings, availabilityData, state.currentDate]);

  // Get bookings for a specific date
  const getBookingsForDate = useCallback((date: Date): CalendarBooking[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return bookings?.filter(booking => booking.date === dateStr) || [];
  }, [bookings]);

  // Get bookings for the selected date
  const selectedDateBookings = useMemo(() => {
    return state.selectedDate ? getBookingsForDate(state.selectedDate) : [];
  }, [state.selectedDate, getBookingsForDate]);

  // Navigation functions
  const goToNext = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentDate: (() => {
        switch (prev.view) {
          case 'month':
            return addMonths(prev.currentDate, 1);
          case 'week':
            return addWeeks(prev.currentDate, 1);
          case 'day':
          case 'agenda':
            return addDays(prev.currentDate, 1);
          default:
            return addMonths(prev.currentDate, 1);
        }
      })(),
    }));
  }, []);

  const goToPrevious = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentDate: (() => {
        switch (prev.view) {
          case 'month':
            return addMonths(prev.currentDate, -1);
          case 'week':
            return addWeeks(prev.currentDate, -1);
          case 'day':
          case 'agenda':
            return addDays(prev.currentDate, -1);
          default:
            return addMonths(prev.currentDate, -1);
        }
      })(),
    }));
  }, []);

  const goToToday = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentDate: new Date(),
      selectedDate: new Date(),
    }));
  }, []);

  const goToDate = useCallback((date: Date) => {
    setState(prev => ({
      ...prev,
      currentDate: date,
      selectedDate: date,
    }));
  }, []);

  // View management
  const changeView = useCallback((view: CalendarView) => {
    setState(prev => ({
      ...prev,
      view,
      selectedDate: null,
      selectedBooking: null,
    }));
  }, []);

  // Selection management
  const selectDate = useCallback((date: Date) => {
    setState(prev => ({
      ...prev,
      selectedDate: isSameDay(date, prev.selectedDate || new Date('1900-01-01'))
        ? null
        : date,
      selectedBooking: null,
    }));
  }, []);

  const selectBooking = useCallback((booking: CalendarBooking) => {
    setState(prev => ({
      ...prev,
      selectedBooking: prev.selectedBooking?.id === booking.id ? null : booking,
      selectedDate: parseISO(booking.date),
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedDate: null,
      selectedBooking: null,
    }));
  }, []);

  // Filter management
  const updateFilters = useCallback((newFilters: Partial<CalendarFilter>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
      selectedDate: null,
      selectedBooking: null,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      filters: { ...(prev.filters.barberId && { barberId: prev.filters.barberId }) }, // Keep barberId if it was originally set
      selectedDate: null,
      selectedBooking: null,
      currentDate: prev.currentDate,
      view: prev.view
    }));
  }, []);

  // Calendar statistics
  const calendarStats = useMemo(() => {
    if (!bookings) return null;

    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const noShowBookings = bookings.filter(b => b.status === 'no_show').length;

    const totalRevenue = bookings
      .filter(b => b.status === 'completed')
      .reduce((sum, b) => sum + b.totalPrice, 0);

    return {
      totalBookings,
      confirmedBookings,
      pendingBookings,
      cancelledBookings,
      completedBookings,
      noShowBookings,
      totalRevenue,
    };
  }, [bookings]);

  // Get current period label
  const currentPeriodLabel = useMemo(() => {
    switch (state.view) {
      case 'month':
        return format(state.currentDate, 'MMMM yyyy');
      case 'week':
        return `${format(startOfWeek(state.currentDate), 'MMM d')} - ${format(
          endOfWeek(state.currentDate),
          'MMM d, yyyy'
        )}`;
      case 'day':
        return format(state.currentDate, 'EEEE, MMMM d, yyyy');
      case 'agenda':
        return `Agenda - ${format(state.currentDate, 'MMMM yyyy')}`;
      default:
        return format(state.currentDate, 'MMMM yyyy');
    }
  }, [state.currentDate, state.view]);

  return {
    // State
    currentDate: state.currentDate,
    view: state.view,
    selectedDate: state.selectedDate,
    selectedBooking: state.selectedBooking,
    filters: state.filters,

    // Data
    calendarDays,
    bookings: bookings || [],
    selectedDateBookings,
    isLoading,
    error,

    // Navigation
    goToNext,
    goToPrevious,
    goToToday,
    goToDate,

    // View management
    changeView,

    // Selection
    selectDate,
    selectBooking,
    clearSelection,

    // Filters
    updateFilters,
    clearFilters,

    // Utilities
    getBookingsForDate,
    currentPeriodLabel,
    calendarStats,
    refetch,
  };
}

// Hook for time slot management within a day
export function useDayTimeSlots(date: Date, barberId?: string) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const { data: timeSlots, isLoading } = useQuery({
    queryKey: ['day-time-slots', format(date, 'yyyy-MM-dd'), barberId],
    queryFn: async () => {
      const params = new URLSearchParams({
        date: format(date, 'yyyy-MM-dd'),
        ...(barberId && { barberId }),
      });

      const response = await fetch(`/api/calendar/time-slots?${params}`);
      if (!response.ok) throw new Error('Failed to fetch time slots');
      return response.json();
    },
    enabled: !!date,
  });

  const selectSlot = useCallback((slotId: string) => {
    setSelectedSlot(prev => prev === slotId ? null : slotId);
  }, []);

  const clearSlotSelection = useCallback(() => {
    setSelectedSlot(null);
  }, []);

  return {
    timeSlots: timeSlots || [],
    selectedSlot,
    isLoading,
    selectSlot,
    clearSlotSelection,
  };
}