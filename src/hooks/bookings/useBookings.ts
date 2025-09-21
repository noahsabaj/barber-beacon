import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateBookingRequestDTO,
  UpdateBookingRequestDTO,
  BookingResponseDTO,
  BookingSearchRequestDTO,
  BookingSearchResponseDTO,
  AvailabilityResponseDTO
} from '@/lib/api/types/api-dtos';

// Query keys for consistent cache management
export const bookingKeys = {
  all: ['bookings'] as const,
  lists: () => [...bookingKeys.all, 'list'] as const,
  list: (filters: BookingSearchRequestDTO) => [...bookingKeys.lists(), { filters }] as const,
  details: () => [...bookingKeys.all, 'detail'] as const,
  detail: (id: string) => [...bookingKeys.details(), id] as const,
  availability: () => [...bookingKeys.all, 'availability'] as const,
  availabilityByBarber: (barberId: string, serviceId: string, date: string) =>
    [...bookingKeys.availability(), { barberId, serviceId, date }] as const,
} as const;

/**
 * Hook for fetching user bookings with filtering and pagination
 */
export function useBookings(params: BookingSearchRequestDTO) {
  return useQuery({
    queryKey: bookingKeys.list(params),
    queryFn: async (): Promise<BookingSearchResponseDTO> => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const searchParams = new URLSearchParams();
      if (params.status) searchParams.append('status', params.status.join(','));
      if (params.startDate) searchParams.append('startDate', params.startDate);
      if (params.endDate) searchParams.append('endDate', params.endDate);
      searchParams.append('page', params.page?.toString() || '1');
      searchParams.append('limit', params.limit?.toString() || '20');

      const response = await fetch(`/api/bookings?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch bookings');
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes for booking data
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook for fetching a specific booking by ID
 */
export function useBooking(bookingId: string) {
  return useQuery({
    queryKey: bookingKeys.detail(bookingId),
    queryFn: async (): Promise<BookingResponseDTO> => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/bookings/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch booking');
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // Booking details can be cached longer
    enabled: !!bookingId, // Only run if bookingId is provided
  });
}

/**
 * Hook for creating a new booking
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookingData: CreateBookingRequestDTO): Promise<BookingResponseDTO> => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(bookingData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create booking');
      }

      const data = await response.json();
      return data.data;
    },
    onSuccess: (newBooking) => {
      // Invalidate all booking lists to reflect the new booking
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });

      // Invalidate availability for the booked time slot
      queryClient.invalidateQueries({ queryKey: bookingKeys.availability() });

      // Optimistically add the new booking to cache
      queryClient.setQueryData(bookingKeys.detail(newBooking.id), newBooking);
    },
  });
}

/**
 * Hook for updating an existing booking
 */
export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      updates
    }: {
      bookingId: string;
      updates: UpdateBookingRequestDTO;
    }): Promise<BookingResponseDTO> => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update booking');
      }

      const data = await response.json();
      return data.data;
    },
    onSuccess: (updatedBooking) => {
      // Update the specific booking in cache
      queryClient.setQueryData(bookingKeys.detail(updatedBooking.id), updatedBooking);

      // Invalidate all booking lists to reflect changes
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });

      // If scheduling time changed, invalidate availability
      queryClient.invalidateQueries({ queryKey: bookingKeys.availability() });
    },
  });
}

/**
 * Hook for cancelling a booking
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      reason
    }: {
      bookingId: string;
      reason?: string;
    }): Promise<{ message: string }> => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel booking');
      }

      return response.json();
    },
    onSuccess: (_, { bookingId }) => {
      // Remove the booking from detail cache
      queryClient.removeQueries({ queryKey: bookingKeys.detail(bookingId) });

      // Invalidate all booking lists
      queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });

      // Invalidate availability to show freed time slots
      queryClient.invalidateQueries({ queryKey: bookingKeys.availability() });
    },
  });
}

/**
 * Hook for checking barber availability
 */
export function useBarberAvailability(params: {
  barberId: string;
  serviceId: string;
  date: string;
  preferredTime?: string;
}) {
  const { barberId, serviceId, date, preferredTime } = params;

  return useQuery({
    queryKey: bookingKeys.availabilityByBarber(barberId, serviceId, date),
    queryFn: async (): Promise<AvailabilityResponseDTO> => {
      const searchParams = new URLSearchParams({
        serviceId,
        date,
      });

      if (preferredTime) {
        searchParams.append('preferredTime', preferredTime);
      }

      const response = await fetch(`/api/barbers/${barberId}/availability?${searchParams}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch availability');
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 1 * 60 * 1000, // Availability data is stale after 1 minute
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    enabled: !!barberId && !!serviceId && !!date, // Only run if all required params provided
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes for real-time availability
  });
}

/**
 * Hook for optimistic booking updates (useful for status changes)
 */
export function useOptimisticBookingUpdate() {
  const queryClient = useQueryClient();

  return {
    updateBookingStatus: (bookingId: string, newStatus: string) => {
      queryClient.setQueryData(
        bookingKeys.detail(bookingId),
        (oldData: BookingResponseDTO | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            status: newStatus,
            updatedAt: new Date().toISOString(),
          };
        }
      );
    },

    rollbackBookingStatus: (bookingId: string) => {
      queryClient.invalidateQueries({ queryKey: bookingKeys.detail(bookingId) });
    },
  };
}