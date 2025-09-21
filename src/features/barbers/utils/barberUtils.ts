import { SearchBarbersResponseDTO } from '@/lib/api/types/api-dtos';
import { calculateDistanceLegacy } from '@/lib/geocoding';

/**
 * Calculate distance between two points using robust geocoding library
 * @deprecated Use calculateDistanceLegacy from @/lib/geocoding directly
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistanceLegacy(lat1, lon1, lat2, lon2);
}

/**
 * Format distance for display
 */
export function formatDistance(miles: number): string {
  if (miles < 1) {
    return `${(miles * 5280).toFixed(0)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

/**
 * Get barber availability status
 */
export function getBarberAvailabilityStatus(
  businessHours: any,
  currentTime: Date = new Date()
): {
  isOpen: boolean;
  nextOpenTime?: Date;
  closingTime?: Date;
  status: 'open' | 'closed' | 'closing_soon';
} {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDayIndex = currentTime.getDay();
  const currentDay = dayNames[currentDayIndex];
  if (!currentDay) return { isOpen: false, status: 'closed' };
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  const todayHours = businessHours?.[currentDay];

  if (!todayHours || !todayHours.isOpen) {
    // Find next open day
    for (let i = 1; i <= 7; i++) {
      const nextDayIndex = (currentTime.getDay() + i) % 7;
      const nextDay = dayNames[nextDayIndex];
      if (!nextDay) continue;
      const nextDayHours = businessHours?.[nextDay];

      if (nextDayHours?.isOpen) {
        const nextOpenTime = new Date(currentTime);
        nextOpenTime.setDate(nextOpenTime.getDate() + i);
        const [openHour, openMinute] = nextDayHours.start.split(':').map(Number);
        nextOpenTime.setHours(openHour, openMinute, 0, 0);

        return {
          isOpen: false,
          nextOpenTime,
          status: 'closed',
        };
      }
    }

    return { isOpen: false, status: 'closed' };
  }

  const [openHour, openMinute] = todayHours.start.split(':').map(Number);
  const [closeHour, closeMinute] = todayHours.end.split(':').map(Number);
  const openTimeMinutes = openHour * 60 + openMinute;
  const closeTimeMinutes = closeHour * 60 + closeMinute;

  const isOpen = currentTimeMinutes >= openTimeMinutes && currentTimeMinutes < closeTimeMinutes;

  if (isOpen) {
    const closingTime = new Date(currentTime);
    closingTime.setHours(closeHour, closeMinute, 0, 0);

    // Check if closing within 30 minutes
    const minutesUntilClose = closeTimeMinutes - currentTimeMinutes;
    const isClosingSoon = minutesUntilClose <= 30;

    return {
      isOpen: true,
      closingTime,
      status: isClosingSoon ? 'closing_soon' : 'open',
    };
  }

  // Closed - find when they open next
  if (currentTimeMinutes < openTimeMinutes) {
    // They open later today
    const nextOpenTime = new Date(currentTime);
    nextOpenTime.setHours(openHour, openMinute, 0, 0);

    return {
      isOpen: false,
      nextOpenTime,
      status: 'closed',
    };
  }

  // They're closed for today - find next open day
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentTime.getDay() + i) % 7;
    const nextDay = dayNames[nextDayIndex];
    if (!nextDay) continue;
    const nextDayHours = businessHours?.[nextDay];

    if (nextDayHours?.isOpen) {
      const nextOpenTime = new Date(currentTime);
      nextOpenTime.setDate(nextOpenTime.getDate() + i);
      const [nextOpenHour, nextOpenMinute] = nextDayHours.start.split(':').map(Number);
      nextOpenTime.setHours(nextOpenHour, nextOpenMinute, 0, 0);

      return {
        isOpen: false,
        nextOpenTime,
        status: 'closed',
      };
    }
  }

  return { isOpen: false, status: 'closed' };
}

/**
 * Format business hours for display
 */
export function formatBusinessHours(businessHours: any): string {
  if (!businessHours) return 'Hours not available';

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  type GroupedHours = { days: string[]; hours: string };
  const hoursText: string[] = [];
  let currentGroup: GroupedHours | null = null;

  dayNames.forEach((day, index) => {
    const dayHours = businessHours[day];
    const dayLabel = dayLabels[index];
    if (!dayLabel) return; // Type guard for noUncheckedIndexedAccess

    if (!dayHours || !dayHours.isOpen) {
      if (currentGroup) {
        hoursText.push(`${currentGroup.days.join('-')}: ${currentGroup.hours}`);
        currentGroup = null;
      }
      hoursText.push(`${dayLabel}: Closed`);
      return;
    }

    const hours = `${formatTime(dayHours.start)} - ${formatTime(dayHours.end)}`;

    if (currentGroup && currentGroup.hours === hours) {
      currentGroup.days.push(dayLabel);
    } else {
      if (currentGroup) {
        hoursText.push(`${currentGroup.days.join('-')}: ${currentGroup.hours}`);
      }
      currentGroup = { days: [dayLabel], hours };
    }
  });

  // Final group check
  if (currentGroup !== null && currentGroup) {
    const finalGroup = currentGroup as GroupedHours;
    hoursText.push(`${finalGroup.days.join('-')}: ${finalGroup.hours}`);
  }

  return hoursText.join('\n');
}

/**
 * Format time from 24-hour to 12-hour format
 */
export function formatTime(time: string): string {
  const parts = time.split(':').map(Number);
  const hour = parts[0] ?? 0;
  const minute = parts[1] ?? 0;
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

/**
 * Get barber's specialties as formatted string
 */
export function formatSpecialties(specialties: string[]): string {
  if (!specialties || specialties.length === 0) return '';

  if (specialties.length <= 3) {
    return specialties.join(', ');
  }

  return `${specialties.slice(0, 3).join(', ')} +${specialties.length - 3} more`;
}

/**
 * Calculate barber rating statistics
 */
export function calculateRatingStats(reviews: Array<{ rating: number }>): {
  average: number;
  distribution: Record<number, number>;
  total: number;
} {
  if (!reviews || reviews.length === 0) {
    return {
      average: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      total: 0,
    };
  }

  const total = reviews.length;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  const average = sum / total;

  const distribution = reviews.reduce((acc, review) => {
    acc[review.rating] = (acc[review.rating] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // Ensure all ratings 1-5 are represented
  for (let i = 1; i <= 5; i++) {
    if (!distribution[i]) distribution[i] = 0;
  }

  return { average, distribution, total };
}

/**
 * Generate Google Maps URL for directions
 */
export function getDirectionsUrl(barber: SearchBarbersResponseDTO['barbers'][0]): string {
  const address = encodeURIComponent(`${barber.address}, ${barber.city}, ${barber.state} ${barber.zipCode}`);
  return `https://maps.google.com/?q=${address}`;
}

/**
 * Generate phone call URL
 */
export function getPhoneUrl(phoneNumber: string): string {
  return `tel:${phoneNumber.replace(/[^\d+]/g, '')}`;
}

/**
 * Generate website URL (ensure https)
 */
export function getWebsiteUrl(website: string): string {
  if (!website) return '';

  if (website.startsWith('http://') || website.startsWith('https://')) {
    return website;
  }

  return `https://${website}`;
}

/**
 * Generate Instagram URL
 */
export function getInstagramUrl(handle: string): string {
  if (!handle) return '';

  const cleanHandle = handle.replace('@', '');
  return `https://instagram.com/${cleanHandle}`;
}

/**
 * Get price range for barber services
 */
export function getServicePriceRange(services: Array<{ price: number }>): {
  min: number;
  max: number;
  range: string;
} {
  if (!services || services.length === 0) {
    return { min: 0, max: 0, range: 'Price not available' };
  }

  const prices = services.map(service => service.price).filter(price => price > 0);

  if (prices.length === 0) {
    return { min: 0, max: 0, range: 'Price not available' };
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (min === max) {
    return { min, max, range: `$${min}` };
  }

  return { min, max, range: `$${min} - $${max}` };
}

/**
 * Check if barber matches search criteria
 */
export function doesBarberMatchSearch(
  barber: SearchBarbersResponseDTO['barbers'][0],
  searchQuery: string
): boolean {
  if (!searchQuery) return true;

  const query = searchQuery.toLowerCase();
  const searchableText = [
    barber.businessName,
    barber.description,
    ...(barber.specialties || []),
    ...(barber.amenities || []),
  ].join(' ').toLowerCase();

  return searchableText.includes(query);
}

/**
 * Sort barbers by various criteria
 */
export function sortBarbers(
  barbers: SearchBarbersResponseDTO['barbers'],
  sortBy: 'distance' | 'rating' | 'price' | 'popularity',
  order: 'asc' | 'desc' = 'asc'
): SearchBarbersResponseDTO['barbers'] {
  return [...barbers].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortBy) {
      case 'distance':
        aValue = a.distance || 0;
        bValue = b.distance || 0;
        break;
      case 'rating':
        aValue = a.rating || 0;
        bValue = b.rating || 0;
        break;
      case 'price':
        // Use average service price
        aValue = 0; // Would need service data
        bValue = 0;
        break;
      case 'popularity':
        aValue = a.reviewCount || 0;
        bValue = b.reviewCount || 0;
        break;
      default:
        aValue = a.distance || 0;
        bValue = b.distance || 0;
    }

    if (order === 'desc') {
      return bValue - aValue;
    }
    return aValue - bValue;
  });
}

/**
 * Filter barbers by criteria
 */
export function filterBarbers(
  barbers: SearchBarbersResponseDTO['barbers'],
  filters: {
    minRating?: number;
    maxDistance?: number;
    serviceTypes?: string[];
    priceRange?: { min?: number; max?: number };
    isOpen?: boolean;
  }
): SearchBarbersResponseDTO['barbers'] {
  return barbers.filter(barber => {
    // Rating filter
    if (filters.minRating && (barber.rating || 0) < filters.minRating) {
      return false;
    }

    // Distance filter
    if (filters.maxDistance && (barber.distance || 0) > filters.maxDistance) {
      return false;
    }

    // Service types filter
    if (filters.serviceTypes && filters.serviceTypes.length > 0) {
      const hasMatchingService = filters.serviceTypes.some(serviceType =>
        (barber.specialties || []).some(specialty =>
          specialty.toLowerCase().includes(serviceType.toLowerCase())
        )
      );
      if (!hasMatchingService) return false;
    }

    // Open status filter
    if (filters.isOpen) {
      const { isOpen } = getBarberAvailabilityStatus(barber.businessHours);
      if (!isOpen) return false;
    }

    return true;
  });
}

/**
 * Generate barber preview text for sharing
 */
export function generateBarberPreview(barber: SearchBarbersResponseDTO['barbers'][0]): string {
  const rating = barber.rating ? `${barber.rating}⭐` : '';
  const reviews = barber.reviewCount ? `(${barber.reviewCount} reviews)` : '';
  const distance = barber.distance ? `${barber.distance.toFixed(1)} mi away` : '';

  return `${barber.businessName} ${rating} ${reviews} - ${distance}`.trim();
}