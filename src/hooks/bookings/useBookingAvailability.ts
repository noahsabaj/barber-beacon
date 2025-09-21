'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';

interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isBooked: boolean;
  isBlocked: boolean;
  price?: number;
  serviceId?: string;
  barberId: string;
}

interface WorkingHours {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // HH:mm format
  endTime: string;
  isWorking: boolean;
}

interface AvailabilityFilters {
  barberId?: string;
  serviceId?: string;
  duration?: number; // in minutes
  date?: Date;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface AvailabilityState {
  selectedDate: Date;
  selectedTimeSlot: TimeSlot | null;
  filters: AvailabilityFilters;
  isLoading: boolean;
  error: string | null;
}

// Hook for checking barber availability
export function useBookingAvailability(barberId: string, serviceId?: string) {
  const [state, setState] = useState<AvailabilityState>({
    selectedDate: new Date(),
    selectedTimeSlot: null,
    filters: { barberId, ...(serviceId !== undefined && { serviceId }) },
    isLoading: false,
    error: null,
  });

  // Fetch barber's working hours
  const { data: workingHours } = useQuery({
    queryKey: ['barber-working-hours', barberId],
    queryFn: async (): Promise<WorkingHours[]> => {
      const response = await fetch(`/api/barbers/${barberId}/working-hours`);
      if (!response.ok) throw new Error('Failed to fetch working hours');
      return response.json();
    },
    enabled: !!barberId,
  });

  // Fetch availability for selected date
  const {
    data: timeSlots,
    isLoading: isLoadingSlots,
    error: slotsError,
    refetch: refetchSlots,
  } = useQuery({
    queryKey: [
      'barber-availability',
      barberId,
      serviceId,
      format(state.selectedDate, 'yyyy-MM-dd'),
    ],
    queryFn: async (): Promise<TimeSlot[]> => {
      const params = new URLSearchParams({
        barberId,
        date: format(state.selectedDate, 'yyyy-MM-dd'),
        ...(serviceId && { serviceId }),
      });

      const response = await fetch(`/api/availability?${params}`);
      if (!response.ok) throw new Error('Failed to fetch availability');
      return response.json();
    },
    enabled: !!barberId && !!state.selectedDate,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Generate time slots based on working hours
  const generateTimeSlots = useCallback((
    date: Date,
    workingHours: WorkingHours[],
    duration: number = 30
  ): TimeSlot[] => {
    const dayOfWeek = date.getDay();
    const todayHours = workingHours?.find(wh => wh.dayOfWeek === dayOfWeek);

    if (!todayHours || !todayHours.isWorking) {
      return [];
    }

    const slots: TimeSlot[] = [];
    const [startHour, startMinute] = todayHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = todayHours.endTime.split(':').map(Number);

    const startTime = new Date(date);
    startTime.setHours(startHour || 0, startMinute || 0, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour || 0, endMinute || 0, 0, 0);

    const current = new Date(startTime);

    while (current < endTime) {
      const slotEnd = new Date(current.getTime() + duration * 60000);

      if (slotEnd <= endTime) {
        slots.push({
          id: `${barberId}-${format(current, 'yyyy-MM-dd-HH:mm')}`,
          startTime: format(current, 'HH:mm'),
          endTime: format(slotEnd, 'HH:mm'),
          isAvailable: true,
          isBooked: false,
          isBlocked: false,
          barberId,
        });
      }

      current.setTime(current.getTime() + duration * 60000);
    }

    return slots;
  }, [barberId]);

  // Filter available slots based on current bookings and blocks
  const availableSlots = useMemo(() => {
    if (!timeSlots || !workingHours) return [];

    const generatedSlots = generateTimeSlots(
      state.selectedDate,
      workingHours,
      state.filters.duration || 30
    );

    // Mark slots as booked or blocked based on existing bookings
    return generatedSlots.map(slot => {
      const existingSlot = timeSlots.find(ts => ts.startTime === slot.startTime);
      return {
        ...slot,
        isAvailable: !existingSlot?.isBooked && !existingSlot?.isBlocked,
        isBooked: existingSlot?.isBooked || false,
        isBlocked: existingSlot?.isBlocked || false,
        price: existingSlot?.price || slot.price,
      };
    });
  }, [timeSlots, workingHours, state.selectedDate, state.filters.duration, generateTimeSlots]);

  // Get available dates in a range
  const getAvailableDates = useCallback((
    startDate: Date,
    endDate: Date
  ): Date[] => {
    if (!workingHours) return [];

    const dates: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const hasWorkingHours = workingHours.some(
        wh => wh.dayOfWeek === dayOfWeek && wh.isWorking
      );

      if (hasWorkingHours) {
        dates.push(new Date(current));
      }

      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [workingHours]);

  // Check if a specific date has availability
  const hasAvailabilityOnDate = useCallback((date: Date): boolean => {
    if (!workingHours) return false;

    const dayOfWeek = date.getDay();
    return workingHours.some(wh => wh.dayOfWeek === dayOfWeek && wh.isWorking);
  }, [workingHours]);

  // Get next available date
  const getNextAvailableDate = useCallback((): Date | null => {
    if (!workingHours) return null;

    const today = new Date();
    let current = new Date(today);

    // Look up to 30 days ahead
    for (let i = 0; i < 30; i++) {
      if (hasAvailabilityOnDate(current)) {
        return current;
      }
      current = addDays(current, 1);
    }

    return null;
  }, [workingHours, hasAvailabilityOnDate]);

  // Select a date
  const selectDate = useCallback((date: Date) => {
    setState(prev => ({
      ...prev,
      selectedDate: date,
      selectedTimeSlot: null,
    }));
  }, []);

  // Select a time slot
  const selectTimeSlot = useCallback((slot: TimeSlot) => {
    if (slot.isAvailable) {
      setState(prev => ({
        ...prev,
        selectedTimeSlot: slot,
      }));
    }
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedTimeSlot: null,
    }));
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<AvailabilityFilters>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
      selectedTimeSlot: null,
    }));
  }, []);

  // Check if booking is possible for selected slot
  const canBook = useMemo(() => {
    return !!(
      state.selectedTimeSlot &&
      state.selectedTimeSlot.isAvailable &&
      !state.selectedTimeSlot.isBooked &&
      !state.selectedTimeSlot.isBlocked
    );
  }, [state.selectedTimeSlot]);

  // Get booking summary
  const getBookingSummary = useCallback(() => {
    if (!state.selectedTimeSlot) return null;

    return {
      barberId,
      serviceId,
      date: state.selectedDate,
      startTime: state.selectedTimeSlot.startTime,
      endTime: state.selectedTimeSlot.endTime,
      duration: state.filters.duration || 30,
      price: state.selectedTimeSlot.price,
    };
  }, [
    barberId,
    serviceId,
    state.selectedDate,
    state.selectedTimeSlot,
    state.filters.duration,
  ]);

  return {
    // State
    selectedDate: state.selectedDate,
    selectedTimeSlot: state.selectedTimeSlot,
    filters: state.filters,
    isLoading: isLoadingSlots,
    error: slotsError?.message || null,

    // Data
    timeSlots: availableSlots,
    workingHours,

    // Actions
    selectDate,
    selectTimeSlot,
    clearSelection,
    updateFilters,
    refetchSlots,

    // Computed values
    canBook,
    hasAvailabilityOnDate,
    getAvailableDates,
    getNextAvailableDate,
    getBookingSummary,
  };
}

// Hook for managing date range availability
export function useDateRangeAvailability(
  barberId: string,
  dateRange: { start: Date; end: Date }
) {
  const { data: availability, isLoading } = useQuery({
    queryKey: [
      'barber-availability-range',
      barberId,
      format(dateRange.start, 'yyyy-MM-dd'),
      format(dateRange.end, 'yyyy-MM-dd'),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        barberId,
        startDate: format(dateRange.start, 'yyyy-MM-dd'),
        endDate: format(dateRange.end, 'yyyy-MM-dd'),
      });

      const response = await fetch(`/api/availability/range?${params}`);
      if (!response.ok) throw new Error('Failed to fetch availability range');
      return response.json();
    },
    enabled: !!barberId && !!dateRange.start && !!dateRange.end,
  });

  const getAvailabilityForDate = useCallback((date: Date) => {
    if (!availability) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    return availability[dateStr] || null;
  }, [availability]);

  const hasAvailabilityOnDate = useCallback((date: Date) => {
    const dayAvailability = getAvailabilityForDate(date);
    return dayAvailability && dayAvailability.availableSlots > 0;
  }, [getAvailabilityForDate]);

  return {
    availability,
    isLoading,
    getAvailabilityForDate,
    hasAvailabilityOnDate,
  };
}