import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SearchBarbersRequestDTO,
  SearchBarbersResponseDTO,
  BarberProfileDetailsResponseDTO
} from '@/lib/api/types/api-dtos';

// Query keys for consistent cache management
export const barberKeys = {
  all: ['barbers'] as const,
  lists: () => [...barberKeys.all, 'list'] as const,
  list: (filters: SearchBarbersRequestDTO) => [...barberKeys.lists(), { filters }] as const,
  details: () => [...barberKeys.all, 'detail'] as const,
  detail: (id: string) => [...barberKeys.details(), id] as const,
  services: () => [...barberKeys.all, 'services'] as const,
  servicesByBarber: (barberId: string) => [...barberKeys.services(), barberId] as const,
  reviews: () => [...barberKeys.all, 'reviews'] as const,
  reviewsByBarber: (barberId: string) => [...barberKeys.reviews(), barberId] as const,
  nearby: () => [...barberKeys.all, 'nearby'] as const,
  nearbyByLocation: (lat: number, lng: number, radius: number) =>
    [...barberKeys.nearby(), { lat, lng, radius }] as const,
} as const;

/**
 * Hook for searching barbers with location and filters
 */
export function useSearchBarbers(params: SearchBarbersRequestDTO) {
  return useQuery({
    queryKey: barberKeys.list(params),
    queryFn: async (): Promise<SearchBarbersResponseDTO> => {
      const searchParams = new URLSearchParams();

      // Required location parameter
      if (params.location) {
        searchParams.append('location', `${params.location.latitude},${params.location.longitude}`);
      }
      if (params.radius !== undefined) {
        searchParams.append('radius', params.radius.toString());
      }

      // Optional filters
      if (params.query) searchParams.append('query', params.query);
      if (params.filters?.serviceTypes) {
        searchParams.append('serviceTypes', params.filters.serviceTypes.join(','));
      }
      if (params.filters?.rating) {
        searchParams.append('minRating', params.filters.rating.toString());
      }
      if (params.filters?.priceRange?.min) {
        searchParams.append('minPrice', params.filters.priceRange.min.toString());
      }
      if (params.filters?.priceRange?.max) {
        searchParams.append('maxPrice', params.filters.priceRange.max.toString());
      }
      if (params.filters?.sortBy) {
        searchParams.append('sortBy', params.filters.sortBy);
      }
      if (params.filters?.sortOrder) {
        searchParams.append('sortOrder', params.filters.sortOrder);
      }

      // Pagination
      searchParams.append('page', params.page?.toString() || '1');
      searchParams.append('limit', params.limit?.toString() || '20');

      const response = await fetch(`/api/barbers?${searchParams}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to search barbers');
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // Consider stale after 5 minutes
    gcTime: 15 * 60 * 1000, // Keep search results for 15 minutes
    enabled: !!params.location?.latitude && !!params.location?.longitude, // Only run with valid location
  });
}

/**
 * Hook for fetching detailed barber profile
 */
export function useBarberProfile(barberId: string) {
  return useQuery({
    queryKey: barberKeys.detail(barberId),
    queryFn: async (): Promise<BarberProfileDetailsResponseDTO> => {
      const response = await fetch(`/api/barbers/${barberId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch barber profile');
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 10 * 60 * 1000, // Profile data can be cached longer
    gcTime: 30 * 60 * 1000, // Keep profiles in cache for 30 minutes
    enabled: !!barberId, // Only run if barberId is provided
  });
}

/**
 * Hook for fetching barbers near a specific location (optimized for map display)
 */
export function useNearbyBarbers(params: {
  latitude: number;
  longitude: number;
  radius: number;
  serviceTypes?: string[];
  minRating?: number;
}) {
  const { latitude, longitude, radius, serviceTypes, minRating } = params;

  return useQuery({
    queryKey: barberKeys.nearbyByLocation(latitude, longitude, radius),
    queryFn: async (): Promise<SearchBarbersResponseDTO> => {
      const searchParams = new URLSearchParams({
        location: `${latitude},${longitude}`,
        radius: radius.toString(),
        limit: '100', // Get more results for map display
      });

      if (serviceTypes) {
        searchParams.append('serviceTypes', serviceTypes.join(','));
      }
      if (minRating) {
        searchParams.append('minRating', minRating.toString());
      }

      const response = await fetch(`/api/barbers?${searchParams}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch nearby barbers');
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 3 * 60 * 1000, // Refresh more frequently for map data
    gcTime: 10 * 60 * 1000,
    enabled: !!latitude && !!longitude && radius > 0,
    refetchOnWindowFocus: false, // Don't refetch map data on focus
  });
}

/**
 * Hook for fetching barber services
 */
export function useBarberServices(barberId: string) {
  return useQuery({
    queryKey: barberKeys.servicesByBarber(barberId),
    queryFn: async () => {
      const response = await fetch(`/api/barbers/${barberId}/services`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch barber services');
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 15 * 60 * 1000, // Services don't change often
    gcTime: 60 * 60 * 1000, // Cache for 1 hour
    enabled: !!barberId,
  });
}

/**
 * Hook for fetching barber reviews
 */
export function useBarberReviews(barberId: string, page: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: [...barberKeys.reviewsByBarber(barberId), { page, limit }],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        barberId,
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/reviews?${searchParams}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch reviews');
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 10 * 60 * 1000, // Reviews can be cached
    gcTime: 30 * 60 * 1000,
    enabled: !!barberId,
  });
}

/**
 * Hook for favoriting/unfavoriting a barber
 */
export function useFavoriteBarber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ barberId, action }: { barberId: string; action: 'add' | 'remove' }) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/barbers/${barberId}/favorite`, {
        method: action === 'add' ? 'POST' : 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update favorite status');
      }

      return response.json();
    },
    onSuccess: (_, { barberId }) => {
      // Invalidate barber profile to update favorite status
      queryClient.invalidateQueries({ queryKey: barberKeys.detail(barberId) });

      // Invalidate search results to update favorite indicators
      queryClient.invalidateQueries({ queryKey: barberKeys.lists() });
    },
  });
}

/**
 * Hook for submitting a barber review
 */
export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reviewData: {
      barberId: string;
      bookingId: string;
      rating: number;
      comment?: string;
      tags?: string[];
      photos?: string[];
    }) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(reviewData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit review');
      }

      return response.json();
    },
    onSuccess: (_, { barberId }) => {
      // Invalidate barber profile to update rating
      queryClient.invalidateQueries({ queryKey: barberKeys.detail(barberId) });

      // Invalidate reviews for this barber
      queryClient.invalidateQueries({ queryKey: barberKeys.reviewsByBarber(barberId) });

      // Invalidate search results to update ratings
      queryClient.invalidateQueries({ queryKey: barberKeys.lists() });
    },
  });
}

/**
 * Hook for getting user's favorite barbers
 */
export function useFavoriteBarbers() {
  return useQuery({
    queryKey: ['favorites', 'barbers'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/user/favorites/barbers', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch favorite barbers');
      }

      const data = await response.json();
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

/**
 * Hook for prefetching barber data (useful for map interactions)
 */
export function usePrefetchBarber() {
  const queryClient = useQueryClient();

  return {
    prefetchBarber: (barberId: string) => {
      queryClient.prefetchQuery({
        queryKey: barberKeys.detail(barberId),
        queryFn: async (): Promise<BarberProfileDetailsResponseDTO> => {
          const response = await fetch(`/api/barbers/${barberId}`);
          if (!response.ok) throw new Error('Failed to fetch barber');
          const data = await response.json();
          return data.data;
        },
        staleTime: 10 * 60 * 1000,
      });
    },
  };
}