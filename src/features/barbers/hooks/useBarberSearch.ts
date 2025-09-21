import { useState, useMemo } from 'react';
import { useSearchBarbers } from '@/hooks/barbers/useBarbers';
import { SearchBarbersRequestDTO, SearchBarbersResponseDTO } from '@/lib/api/types/api-dtos';

interface SearchFilters {
  query?: string;
  serviceTypes: string[];
  minRating?: number;
  priceRange?: {
    min?: number;
    max?: number;
  };
  sortBy: 'distance' | 'rating' | 'price' | 'popularity';
  sortOrder: 'asc' | 'desc';
  onlyOpen?: boolean;
  hasAvailability?: boolean;
}

interface UseBarberSearchReturn {
  searchParams: SearchBarbersRequestDTO;
  searchResult: SearchBarbersResponseDTO | undefined;
  isLoading: boolean;
  error: Error | null;
  filters: SearchFilters;
  setFilters: (filters: Partial<SearchFilters>) => void;
  resetFilters: () => void;
  hasActiveFilters: boolean;
  refetch: () => void;
}

const defaultFilters: SearchFilters = {
  serviceTypes: [],
  sortBy: 'distance',
  sortOrder: 'asc',
  onlyOpen: false,
  hasAvailability: false,
};

/**
 * Hook for managing barber search with filters
 */
export function useBarberSearch(
  location: { latitude: number; longitude: number },
  radius: number = 25
): UseBarberSearchReturn {
  const [filters, setFiltersState] = useState<SearchFilters>(defaultFilters);

  const searchParams: SearchBarbersRequestDTO = useMemo(() => {
    const params: any = {
      location,
      radius,
      filters: {
        location,
        radius,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      },
      page: 1,
      limit: 20,
    };

    if (filters.query !== undefined) {
      params.query = filters.query;
      params.filters.query = filters.query;
    }
    if (filters.serviceTypes.length > 0) {
      params.filters.serviceTypes = filters.serviceTypes;
    }
    if (filters.minRating !== undefined) {
      params.filters.rating = filters.minRating;
    }
    if (filters.priceRange !== undefined) {
      params.filters.priceRange = filters.priceRange;
    }

    return params as SearchBarbersRequestDTO;
  }, [location, radius, filters]);

  const {
    data: searchResult,
    isLoading,
    error,
    refetch,
  } = useSearchBarbers(searchParams);

  const setFilters = (newFilters: Partial<SearchFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFiltersState(defaultFilters);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.serviceTypes.length > 0 ||
      !!filters.minRating ||
      !!filters.priceRange?.min ||
      !!filters.priceRange?.max ||
      !!filters.query ||
      filters.onlyOpen ||
      filters.hasAvailability
    );
  }, [filters]);

  return {
    searchParams,
    searchResult: searchResult as SearchBarbersResponseDTO | undefined,
    isLoading,
    error,
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters: !!hasActiveFilters,
    refetch,
  };
}

/**
 * Hook for managing search history
 */
export function useSearchHistory() {
  const [searchHistory, setSearchHistory] = useState<Array<{
    id: string;
    query: string;
    location: string;
    timestamp: Date;
  }>>([]);

  const addToHistory = (query: string, location: string) => {
    const newEntry = {
      id: `search-${Date.now()}`,
      query,
      location,
      timestamp: new Date(),
    };

    setSearchHistory(prev => [
      newEntry,
      ...prev.filter(item => item.query !== query).slice(0, 9) // Keep last 10 unique searches
    ]);
  };

  const removeFromHistory = (id: string) => {
    setSearchHistory(prev => prev.filter(item => item.id !== id));
  };

  const clearHistory = () => {
    setSearchHistory([]);
  };

  return {
    searchHistory,
    addToHistory,
    removeFromHistory,
    clearHistory,
  };
}

/**
 * Hook for managing saved searches
 */
export function useSavedSearches() {
  const [savedSearches, setSavedSearches] = useState<Array<{
    id: string;
    name: string;
    searchParams: SearchBarbersRequestDTO;
    createdAt: Date;
  }>>([]);

  const saveSearch = (name: string, searchParams: SearchBarbersRequestDTO) => {
    const newSavedSearch = {
      id: `saved-${Date.now()}`,
      name,
      searchParams,
      createdAt: new Date(),
    };

    setSavedSearches(prev => [newSavedSearch, ...prev]);
  };

  const removeSavedSearch = (id: string) => {
    setSavedSearches(prev => prev.filter(search => search.id !== id));
  };

  const loadSavedSearch = (id: string) => {
    return savedSearches.find(search => search.id === id);
  };

  return {
    savedSearches,
    saveSearch,
    removeSavedSearch,
    loadSavedSearch,
  };
}

/**
 * Hook for search suggestions
 */
export function useSearchSuggestions(query: string, delay: number = 300) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced search for suggestions
  useMemo(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Mock suggestions - in real app, this would call an API
        const mockSuggestions = [
          'haircut',
          'beard trim',
          'hair wash',
          'styling',
          'shave',
          'color',
          'highlight',
        ].filter(suggestion =>
          suggestion.toLowerCase().includes(query.toLowerCase())
        );

        setSuggestions(mockSuggestions);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [query, delay]);

  return {
    suggestions,
    isLoading,
  };
}

/**
 * Hook for popular searches
 */
export function usePopularSearches() {
  // Mock popular searches - in real app, this would come from analytics
  const popularSearches = [
    'haircut near me',
    'beard trim',
    'best barber',
    'hair styling',
    'fade haircut',
    'beard grooming',
    'hair wash',
    'modern haircut',
  ];

  return {
    popularSearches,
  };
}