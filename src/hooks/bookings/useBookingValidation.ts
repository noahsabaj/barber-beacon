'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAfter, isBefore, addMinutes, parseISO, format, differenceInMinutes } from 'date-fns';

interface BookingData {
  barberId: string;
  serviceId: string;
  date: Date;
  startTime: string;
  endTime?: string;
  customerId?: string;
  notes?: string;
  totalPrice?: number;
}

interface ValidationRule {
  id: string;
  name: string;
  isValid: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface BookingConstraints {
  minAdvanceBooking: number; // hours
  maxAdvanceBooking: number; // days
  cancellationDeadline: number; // hours
  rescheduleDeadline: number; // hours
  maxDailyBookings: number;
  blackoutDates: string[];
  allowSameDayBooking: boolean;
  businessHours: {
    start: string;
    end: string;
  };
}

interface ConflictingBooking {
  id: string;
  startTime: string;
  endTime: string;
  customerName?: string;
  serviceName?: string;
}

// Main booking validation hook
export function useBookingValidation(bookingData: Partial<BookingData>) {
  const [validationRules, setValidationRules] = useState<ValidationRule[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Fetch booking constraints for the barber
  const { data: constraints } = useQuery({
    queryKey: ['booking-constraints', bookingData.barberId],
    queryFn: async (): Promise<BookingConstraints> => {
      const response = await fetch(`/api/barbers/${bookingData.barberId}/booking-constraints`);
      if (!response.ok) throw new Error('Failed to fetch booking constraints');
      return response.json();
    },
    enabled: !!bookingData.barberId,
  });

  // Fetch service details
  const { data: service } = useQuery({
    queryKey: ['service', bookingData.serviceId],
    queryFn: async () => {
      const response = await fetch(`/api/services/${bookingData.serviceId}`);
      if (!response.ok) throw new Error('Failed to fetch service details');
      return response.json();
    },
    enabled: !!bookingData.serviceId,
  });

  // Check for conflicting bookings
  const { data: conflictingBookings } = useQuery({
    queryKey: [
      'conflicting-bookings',
      bookingData.barberId,
      bookingData.date ? format(bookingData.date, 'yyyy-MM-dd') : null,
      bookingData.startTime,
    ],
    queryFn: async (): Promise<ConflictingBooking[]> => {
      if (!bookingData.date || !bookingData.startTime) return [];

      const params = new URLSearchParams({
        barberId: bookingData.barberId!,
        date: format(bookingData.date, 'yyyy-MM-dd'),
        startTime: bookingData.startTime,
        ...(bookingData.endTime && { endTime: bookingData.endTime }),
      });

      const response = await fetch(`/api/bookings/conflicts?${params}`);
      if (!response.ok) throw new Error('Failed to check for conflicts');
      return response.json();
    },
    enabled: !!(
      bookingData.barberId &&
      bookingData.date &&
      bookingData.startTime
    ),
  });

  // Validate booking data
  const validateBooking = useCallback(() => {
    if (!bookingData || !constraints || !service) return;

    const rules: ValidationRule[] = [];
    const now = new Date();

    // Required fields validation
    if (!bookingData.barberId) {
      rules.push({
        id: 'barber-required',
        name: 'Barber Selection',
        isValid: false,
        message: 'Please select a barber',
        severity: 'error',
      });
    }

    if (!bookingData.serviceId) {
      rules.push({
        id: 'service-required',
        name: 'Service Selection',
        isValid: false,
        message: 'Please select a service',
        severity: 'error',
      });
    }

    if (!bookingData.date) {
      rules.push({
        id: 'date-required',
        name: 'Date Selection',
        isValid: false,
        message: 'Please select a date',
        severity: 'error',
      });
    }

    if (!bookingData.startTime) {
      rules.push({
        id: 'time-required',
        name: 'Time Selection',
        isValid: false,
        message: 'Please select a time',
        severity: 'error',
      });
    }

    // Date and time validations
    if (bookingData.date && bookingData.startTime) {
      const bookingDateTime = new Date(bookingData.date);
      const [hours, minutes] = bookingData.startTime.split(':').map(Number);
      bookingDateTime.setHours(hours || 0, minutes || 0, 0, 0);

      // Minimum advance booking time
      const minAdvanceTime = addMinutes(now, constraints.minAdvanceBooking * 60);
      if (isBefore(bookingDateTime, minAdvanceTime)) {
        rules.push({
          id: 'min-advance-booking',
          name: 'Advance Booking',
          isValid: false,
          message: `Bookings must be made at least ${constraints.minAdvanceBooking} hours in advance`,
          severity: 'error',
        });
      }

      // Maximum advance booking time
      const maxAdvanceTime = new Date(now);
      maxAdvanceTime.setDate(maxAdvanceTime.getDate() + constraints.maxAdvanceBooking);
      if (isAfter(bookingDateTime, maxAdvanceTime)) {
        rules.push({
          id: 'max-advance-booking',
          name: 'Advance Booking Limit',
          isValid: false,
          message: `Bookings can only be made up to ${constraints.maxAdvanceBooking} days in advance`,
          severity: 'error',
        });
      }

      // Same day booking validation
      if (!constraints.allowSameDayBooking) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const bookingDate = new Date(bookingData.date);
        bookingDate.setHours(0, 0, 0, 0);

        if (bookingDate.getTime() === today.getTime()) {
          rules.push({
            id: 'same-day-booking',
            name: 'Same Day Booking',
            isValid: false,
            message: 'Same day bookings are not allowed',
            severity: 'error',
          });
        }
      }

      // Business hours validation
      const bookingTime = bookingData.startTime;
      const businessStart = constraints.businessHours.start;
      const businessEnd = constraints.businessHours.end;

      if (bookingTime < businessStart || bookingTime > businessEnd) {
        rules.push({
          id: 'business-hours',
          name: 'Business Hours',
          isValid: false,
          message: `Bookings must be within business hours (${businessStart} - ${businessEnd})`,
          severity: 'error',
        });
      }

      // Blackout dates validation
      const dateStr = format(bookingData.date, 'yyyy-MM-dd');
      if (constraints.blackoutDates.includes(dateStr)) {
        rules.push({
          id: 'blackout-date',
          name: 'Blackout Date',
          isValid: false,
          message: 'This date is not available for bookings',
          severity: 'error',
        });
      }
    }

    // Service duration validation
    if (service && bookingData.startTime && bookingData.endTime) {
      const startTime = parseISO(`2000-01-01T${bookingData.startTime}:00`);
      const endTime = parseISO(`2000-01-01T${bookingData.endTime}:00`);
      const duration = differenceInMinutes(endTime, startTime);

      if (duration < service.minDuration) {
        rules.push({
          id: 'min-duration',
          name: 'Service Duration',
          isValid: false,
          message: `Service requires at least ${service.minDuration} minutes`,
          severity: 'error',
        });
      }

      if (service.maxDuration && duration > service.maxDuration) {
        rules.push({
          id: 'max-duration',
          name: 'Service Duration',
          isValid: false,
          message: `Service cannot exceed ${service.maxDuration} minutes`,
          severity: 'error',
        });
      }
    }

    // Conflict validation
    if (conflictingBookings && conflictingBookings.length > 0) {
      rules.push({
        id: 'booking-conflict',
        name: 'Time Slot Conflict',
        isValid: false,
        message: `This time slot conflicts with existing booking${conflictingBookings.length > 1 ? 's' : ''}`,
        severity: 'error',
      });
    }

    // Price validation
    if (bookingData.totalPrice !== undefined && service) {
      if (bookingData.totalPrice < service.basePrice) {
        rules.push({
          id: 'min-price',
          name: 'Service Price',
          isValid: false,
          message: `Price cannot be less than service base price of $${service.basePrice}`,
          severity: 'error',
        });
      }
    }

    // Customer validation
    if (!bookingData.customerId) {
      rules.push({
        id: 'customer-required',
        name: 'Customer Information',
        isValid: false,
        message: 'Customer information is required',
        severity: 'error',
      });
    }

    // Add valid rules for passed validations
    const allValidationIds = [
      'barber-required',
      'service-required',
      'date-required',
      'time-required',
      'min-advance-booking',
      'max-advance-booking',
      'same-day-booking',
      'business-hours',
      'blackout-date',
      'min-duration',
      'max-duration',
      'booking-conflict',
      'min-price',
      'customer-required',
    ];

    allValidationIds.forEach(id => {
      if (!rules.find(rule => rule.id === id)) {
        const validRuleName = getValidationRuleName(id);
        if (validRuleName) {
          rules.push({
            id,
            name: validRuleName,
            isValid: true,
            message: 'Valid',
            severity: 'info',
          });
        }
      }
    });

    setValidationRules(rules);
  }, [bookingData, constraints, service, conflictingBookings]);

  // Helper function to get rule names
  const getValidationRuleName = (id: string): string | null => {
    const names: { [key: string]: string } = {
      'barber-required': 'Barber Selection',
      'service-required': 'Service Selection',
      'date-required': 'Date Selection',
      'time-required': 'Time Selection',
      'min-advance-booking': 'Advance Booking',
      'max-advance-booking': 'Advance Booking Limit',
      'same-day-booking': 'Same Day Booking',
      'business-hours': 'Business Hours',
      'blackout-date': 'Blackout Date',
      'min-duration': 'Service Duration',
      'max-duration': 'Service Duration',
      'booking-conflict': 'Time Slot Conflict',
      'min-price': 'Service Price',
      'customer-required': 'Customer Information',
    };
    return names[id] || null;
  };

  // Run validation when dependencies change
  useEffect(() => {
    setIsValidating(true);
    const timeoutId = setTimeout(() => {
      validateBooking();
      setIsValidating(false);
    }, 300); // Debounce validation

    return () => clearTimeout(timeoutId);
  }, [validateBooking]);

  // Computed values
  const isValid = useMemo(() => {
    return validationRules.length > 0 &&
           validationRules.filter(rule => rule.severity === 'error').every(rule => rule.isValid);
  }, [validationRules]);

  const errors = useMemo(() => {
    return validationRules.filter(rule => rule.severity === 'error' && !rule.isValid);
  }, [validationRules]);

  const warnings = useMemo(() => {
    return validationRules.filter(rule => rule.severity === 'warning' && !rule.isValid);
  }, [validationRules]);

  const hasConflicts = useMemo(() => {
    return conflictingBookings && conflictingBookings.length > 0;
  }, [conflictingBookings]);

  return {
    // Validation state
    isValid,
    isValidating,
    validationRules,
    errors,
    warnings,

    // Conflicts
    hasConflicts,
    conflictingBookings: conflictingBookings || [],

    // Constraints
    constraints,
    service,

    // Actions
    validateBooking,
  };
}

// Hook for validating booking modifications
export function useBookingModificationValidation(
  originalBooking: any,
  modifiedBooking: Partial<BookingData>
) {
  const validation = useBookingValidation(modifiedBooking);

  const canModify = useMemo(() => {
    if (!originalBooking || !validation.constraints) return false;

    const now = new Date();
    const bookingDateTime = new Date(originalBooking.date);
    const [hours, minutes] = originalBooking.startTime.split(':').map(Number);
    bookingDateTime.setHours(hours, minutes, 0, 0);

    // Check if within modification deadline
    const modificationDeadline = new Date(bookingDateTime);
    modificationDeadline.setHours(
      modificationDeadline.getHours() - validation.constraints.rescheduleDeadline
    );

    return isAfter(modificationDeadline, now);
  }, [originalBooking, validation.constraints]);

  const canCancel = useMemo(() => {
    if (!originalBooking || !validation.constraints) return false;

    const now = new Date();
    const bookingDateTime = new Date(originalBooking.date);
    const [hours, minutes] = originalBooking.startTime.split(':').map(Number);
    bookingDateTime.setHours(hours, minutes, 0, 0);

    // Check if within cancellation deadline
    const cancellationDeadline = new Date(bookingDateTime);
    cancellationDeadline.setHours(
      cancellationDeadline.getHours() - validation.constraints.cancellationDeadline
    );

    return isAfter(cancellationDeadline, now);
  }, [originalBooking, validation.constraints]);

  return {
    ...validation,
    canModify,
    canCancel,
    originalBooking,
  };
}