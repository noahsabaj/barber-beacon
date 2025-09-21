import { useState, useMemo } from 'react';
import { BookingResponseDTO, BookingSearchRequestDTO } from '@/lib/api/types/api-dtos';

type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

interface BookingFilters {
  status: BookingStatus[];
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  searchQuery: string;
  sortBy: 'date' | 'status' | 'price' | 'service';
  sortOrder: 'asc' | 'desc';
}

interface UseBookingFiltersReturn {
  filters: BookingFilters;
  setFilters: (filters: Partial<BookingFilters>) => void;
  resetFilters: () => void;
  getSearchParams: () => BookingSearchRequestDTO;
  filterBookings: (bookings: BookingResponseDTO[]) => BookingResponseDTO[];
  hasActiveFilters: boolean;
}

const defaultFilters: BookingFilters = {
  status: [],
  dateRange: {
    from: null,
    to: null,
  },
  searchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
};

/**
 * Hook for managing booking filters and search
 */
export function useBookingFilters(): UseBookingFiltersReturn {
  const [filters, setFiltersState] = useState<BookingFilters>(defaultFilters);

  const setFilters = (newFilters: Partial<BookingFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFiltersState(defaultFilters);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.status.length > 0 ||
      filters.dateRange.from !== null ||
      filters.dateRange.to !== null ||
      filters.searchQuery.trim() !== ''
    );
  }, [filters]);

  const getSearchParams = (): BookingSearchRequestDTO => {
    return {
      ...(filters.status.length > 0 && { status: filters.status }),
      ...(filters.dateRange.from && { startDate: filters.dateRange.from.toISOString() }),
      ...(filters.dateRange.to && { endDate: filters.dateRange.to.toISOString() }),
      page: 1,
      limit: 20,
    } as BookingSearchRequestDTO;
  };

  const filterBookings = (bookings: BookingResponseDTO[]): BookingResponseDTO[] => {
    let filtered = [...bookings];

    // Filter by status
    if (filters.status.length > 0) {
      filtered = filtered.filter(booking => filters.status.includes(booking.status as BookingStatus));
    }

    // Filter by date range
    if (filters.dateRange.from) {
      const fromDate = new Date(filters.dateRange.from);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(booking => new Date(booking.scheduledTime) >= fromDate);
    }

    if (filters.dateRange.to) {
      const toDate = new Date(filters.dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(booking => new Date(booking.scheduledTime) <= toDate);
    }

    // Filter by search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(booking => {
        const serviceName = booking.service.name.toLowerCase();
        const barberName = booking.barber.businessName.toLowerCase();
        const customerName = `${booking.user.firstName} ${booking.user.lastName}`.toLowerCase();

        return (
          serviceName.includes(query) ||
          barberName.includes(query) ||
          customerName.includes(query) ||
          booking.notes?.toLowerCase().includes(query)
        );
      });
    }

    // Sort bookings
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (filters.sortBy) {
        case 'date':
          aValue = new Date(a.scheduledTime);
          bValue = new Date(b.scheduledTime);
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'price':
          aValue = a.totalPrice;
          bValue = b.totalPrice;
          break;
        case 'service':
          aValue = a.service.name;
          bValue = b.service.name;
          break;
        default:
          aValue = new Date(a.scheduledTime);
          bValue = new Date(b.scheduledTime);
      }

      if (aValue < bValue) return filters.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return filters.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  return {
    filters,
    setFilters,
    resetFilters,
    getSearchParams,
    filterBookings,
    hasActiveFilters,
  };
}

/**
 * Hook for getting booking statistics
 */
export function useBookingStats(bookings: BookingResponseDTO[]) {
  return useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const stats = {
      total: bookings.length,
      upcoming: 0,
      past: 0,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      byStatus: {
        PENDING: 0,
        CONFIRMED: 0,
        COMPLETED: 0,
        CANCELLED: 0,
        NO_SHOW: 0,
      },
      totalRevenue: 0,
      averagePrice: 0,
    };

    bookings.forEach(booking => {
      const scheduledTime = new Date(booking.scheduledTime);

      // Count by time periods
      if (scheduledTime >= today) {
        stats.upcoming++;
      } else {
        stats.past++;
      }

      if (scheduledTime.toDateString() === today.toDateString()) {
        stats.today++;
      }

      if (scheduledTime >= thisWeek) {
        stats.thisWeek++;
      }

      if (scheduledTime >= thisMonth) {
        stats.thisMonth++;
      }

      // Count by status
      stats.byStatus[booking.status as keyof typeof stats.byStatus]++;

      // Calculate revenue (only for completed bookings)
      if (booking.status === 'COMPLETED') {
        stats.totalRevenue += booking.totalPrice;
      }
    });

    // Calculate average price
    const completedBookings = stats.byStatus.COMPLETED;
    stats.averagePrice = completedBookings > 0 ? stats.totalRevenue / completedBookings : 0;

    return stats;
  }, [bookings]);
}

/**
 * Hook for booking time slot utilities
 */
export function useBookingTimeSlots() {
  const isTimeSlotAvailable = (
    timeSlot: Date,
    existingBookings: BookingResponseDTO[],
    duration: number = 60
  ): boolean => {
    const slotStart = timeSlot.getTime();
    const slotEnd = slotStart + (duration * 60 * 1000);

    return !existingBookings.some(booking => {
      if (booking.status === 'CANCELLED') return false;

      const bookingStart = new Date(booking.scheduledTime).getTime();
      const bookingEnd = bookingStart + (booking.duration * 60 * 1000);

      // Check for overlap
      return (slotStart < bookingEnd && slotEnd > bookingStart);
    });
  };

  const generateTimeSlots = (
    date: Date,
    businessHours: { start: string; end: string },
    duration: number = 60,
    interval: number = 15
  ): Date[] => {
    const slots: Date[] = [];
    const [startHour, startMinute] = businessHours.start.split(':').map(Number);
    const [endHour, endMinute] = businessHours.end.split(':').map(Number);

    const startTime = new Date(date);
    startTime.setHours(startHour || 0, startMinute || 0, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour || 0, endMinute || 0, 0, 0);

    let currentTime = new Date(startTime);

    while (currentTime.getTime() + (duration * 60 * 1000) <= endTime.getTime()) {
      slots.push(new Date(currentTime));
      currentTime.setMinutes(currentTime.getMinutes() + interval);
    }

    return slots;
  };

  const getNextAvailableSlot = (
    existingBookings: BookingResponseDTO[],
    businessHours: { start: string; end: string },
    duration: number = 60
  ): Date | null => {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + 1); // Start from tomorrow

    // Check next 30 days
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + i);

      const timeSlots = generateTimeSlots(checkDate, businessHours, duration);

      for (const slot of timeSlots) {
        if (isTimeSlotAvailable(slot, existingBookings, duration)) {
          return slot;
        }
      }
    }

    return null;
  };

  return {
    isTimeSlotAvailable,
    generateTimeSlots,
    getNextAvailableSlot,
  };
}