// Barber Components
export { BarberCard } from './components/BarberCard';
export { BarberSearchForm } from './components/BarberSearchForm';

// Barber Hooks
export {
  useBarberSearch,
  useSearchHistory,
  useSavedSearches,
  useSearchSuggestions,
  usePopularSearches,
} from './hooks/useBarberSearch';

// Barber Utils
export {
  calculateDistance,
  formatDistance,
  getBarberAvailabilityStatus,
  formatBusinessHours,
  formatTime,
  formatSpecialties,
  calculateRatingStats,
  getDirectionsUrl,
  getPhoneUrl,
  getWebsiteUrl,
  getInstagramUrl,
  getServicePriceRange,
  doesBarberMatchSearch,
  sortBarbers,
  filterBarbers,
  generateBarberPreview,
} from './utils/barberUtils';

// Re-export base barber hooks for convenience
export {
  useSearchBarbers,
  useBarberProfile,
  useNearbyBarbers,
  useBarberServices,
  useBarberReviews,
  useFavoriteBarber,
  useSubmitReview,
  useFavoriteBarbers,
  usePrefetchBarber,
  barberKeys,
} from '@/hooks/barbers/useBarbers';