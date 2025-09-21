'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Search,
  MapPin,
  SlidersHorizontal,
  X,
  Star,
  DollarSign,
  Scissors,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { useUIStore } from '@/stores/uiStore';
import { SearchErrorBoundary } from '@/components/ErrorBoundary/FeatureErrorBoundary';

const searchSchema = z.object({
  query: z.string().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string(),
  }),
  radius: z.number().min(1).max(50).default(25),
  serviceTypes: z.array(z.string()).default([]),
  minRating: z.number().min(1).max(5).optional(),
  priceRange: z.object({
    min: z.number().min(0).optional(),
    max: z.number().min(0).optional(),
  }).optional(),
  sortBy: z.enum(['distance', 'rating', 'price', 'popularity']).default('distance'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

type SearchFormData = z.infer<typeof searchSchema>;

interface BarberSearchFormProps {
  onSearch: (searchData: SearchFormData) => void;
  isLoading?: boolean;
  defaultValues?: Partial<SearchFormData>;
}

const serviceTypes = [
  'Haircut',
  'Beard Trim',
  'Shave',
  'Hair Wash',
  'Styling',
  'Color',
  'Highlight',
  'Perm',
  'Straightening',
  'Treatment',
];

const sortOptions = [
  { value: 'distance', label: 'Distance' },
  { value: 'rating', label: 'Rating' },
  { value: 'price', label: 'Price' },
  { value: 'popularity', label: 'Popularity' },
];

export function BarberSearchForm({
  onSearch,
  isLoading = false,
  defaultValues,
}: BarberSearchFormProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const uiStore = useUIStore();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
  } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema) as any,
    defaultValues: {
      radius: 25,
      serviceTypes: [],
      sortBy: 'distance',
      sortOrder: 'asc',
      ...defaultValues,
    },
  });

  const watchedRadius = watch('radius');
  const watchedServiceTypes = watch('serviceTypes');
  const watchedMinRating = watch('minRating');
  const watchedPriceRange = watch('priceRange');

  // Load search params on mount
  useEffect(() => {
    const query = searchParams.get('q');
    const radius = searchParams.get('radius');
    const services = searchParams.get('services');
    const rating = searchParams.get('rating');
    const sortBy = searchParams.get('sortBy');

    if (query) setValue('query', query);
    if (radius) setValue('radius', parseInt(radius));
    if (services) setValue('serviceTypes', services.split(','));
    if (rating) setValue('minRating', parseFloat(rating));
    if (sortBy) setValue('sortBy', sortBy as any);
  }, [searchParams, setValue]);

  const getCurrentLocation = async () => {
    setIsLocationLoading(true);

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get address
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await response.json();

        setValue('location', {
          latitude,
          longitude,
          address: data.display_name || `${latitude}, ${longitude}`,
        });

        uiStore.addToast({
          type: 'success',
          title: 'Location Found',
          message: 'Using your current location for search.',
        });
      } catch (geocodeError) {
        // Use coordinates if reverse geocoding fails
        setValue('location', {
          latitude,
          longitude,
          address: `${latitude}, ${longitude}`,
        });
      }
    } catch (error: any) {
      uiStore.addToast({
        type: 'error',
        title: 'Location Access Failed',
        message: 'Please enter your location manually.',
      });
    } finally {
      setIsLocationLoading(false);
    }
  };

  const handleLocationSearch = async (address: string) => {
    if (!address.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
      );
      const data = await response.json();

      if (data.length > 0) {
        const result = data[0];
        setValue('location', {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          address: result.display_name,
        });
      } else {
        uiStore.addToast({
          type: 'warning',
          title: 'Location Not Found',
          message: 'Please try a different address.',
        });
      }
    } catch (error) {
      uiStore.addToast({
        type: 'error',
        title: 'Search Failed',
        message: 'Failed to find location. Please try again.',
      });
    }
  };

  const onSubmit = (data: SearchFormData) => {
    onSearch(data);

    // Update URL params
    const params = new URLSearchParams();
    if (data.query) params.set('q', data.query);
    if (data.radius !== 25) params.set('radius', data.radius.toString());
    if (data.serviceTypes.length > 0) params.set('services', data.serviceTypes.join(','));
    if (data.minRating) params.set('rating', data.minRating.toString());
    if (data.sortBy !== 'distance') params.set('sortBy', data.sortBy);

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.push(`/barbers${newUrl}`, { scroll: false });
  };

  const clearFilters = () => {
    setValue('serviceTypes', []);
    setValue('minRating', undefined);
    setValue('priceRange', undefined);
    setValue('radius', 25);
    setValue('sortBy', 'distance');
    setValue('sortOrder', 'asc');
  };

  const removeServiceType = (serviceType: string) => {
    const current = watchedServiceTypes || [];
    setValue('serviceTypes', current.filter(s => s !== serviceType));
  };

  const hasActiveFilters = () => {
    return (
      (watchedServiceTypes && watchedServiceTypes.length > 0) ||
      watchedMinRating ||
      (watchedPriceRange && (watchedPriceRange.min || watchedPriceRange.max)) ||
      watchedRadius !== 25
    );
  };

  return (
    <SearchErrorBoundary>
      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
        {/* Search Query */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search for barbers, services, or specialties..."
            className="pl-10"
            {...register('query')}
          />
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label>Location</Label>
          <div className="flex space-x-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Enter city, address, or zip code"
                className="pl-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLocationSearch(e.currentTarget.value);
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentLocation}
              disabled={isLocationLoading}
            >
              {isLocationLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Label className="text-sm">Within:</Label>
            <Select
              value={watchedRadius?.toString()}
              onValueChange={(value) => setValue('radius', parseInt(value))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 mi</SelectItem>
                <SelectItem value="10">10 mi</SelectItem>
                <SelectItem value="25">25 mi</SelectItem>
                <SelectItem value="50">50 mi</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              Filters
              {hasActiveFilters() && (
                <Badge variant="secondary" className="ml-2">
                  {(watchedServiceTypes?.length || 0) +
                   (watchedMinRating ? 1 : 0) +
                   (watchedPriceRange?.min || watchedPriceRange?.max ? 1 : 0)}
                </Badge>
              )}
            </Button>

            {hasActiveFilters() && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters() && (
          <div className="flex flex-wrap gap-2">
            {watchedServiceTypes?.map((serviceType) => (
              <Badge
                key={serviceType}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {serviceType}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => removeServiceType(serviceType)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}

            {watchedMinRating && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {watchedMinRating}+ stars
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 ml-1"
                  onClick={() => setValue('minRating', undefined)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            )}

            {watchedRadius !== 25 && (
              <Badge variant="secondary">
                Within {watchedRadius} mi
              </Badge>
            )}
          </div>
        )}

        {/* Advanced Filters */}
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent className="space-y-4 border-t pt-4">
            {/* Service Types */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Scissors className="h-4 w-4" />
                Service Types
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {serviceTypes.map((serviceType) => (
                  <div key={serviceType} className="flex items-center space-x-2">
                    <Checkbox
                      id={serviceType}
                      checked={watchedServiceTypes?.includes(serviceType)}
                      onCheckedChange={(checked: any) => {
                        const current = watchedServiceTypes || [];
                        if (checked) {
                          setValue('serviceTypes', [...current, serviceType]);
                        } else {
                          setValue('serviceTypes', current.filter(s => s !== serviceType));
                        }
                      }}
                    />
                    <Label htmlFor={serviceType} className="text-sm">
                      {serviceType}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Rating Filter */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Minimum Rating
              </Label>
              <div className="flex items-center space-x-4">
                <Slider
                  value={[watchedMinRating || 1]}
                  onValueChange={([value]) => setValue('minRating', value)}
                  max={5}
                  min={1}
                  step={0.5}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-12">
                  {watchedMinRating || 1}+
                </span>
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Price Range
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="minPrice" className="text-xs">Min</Label>
                  <Input
                    id="minPrice"
                    type="number"
                    placeholder="$0"
                    min="0"
                    value={watchedPriceRange?.min || ''}
                    onChange={(e) =>
                      setValue('priceRange', {
                        ...watchedPriceRange,
                        min: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="maxPrice" className="text-xs">Max</Label>
                  <Input
                    id="maxPrice"
                    type="number"
                    placeholder="$200"
                    min="0"
                    value={watchedPriceRange?.max || ''}
                    onChange={(e) =>
                      setValue('priceRange', {
                        ...watchedPriceRange,
                        max: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-2">
              <Label>Sort By</Label>
              <div className="flex space-x-2">
                <Select
                  value={watch('sortBy')}
                  onValueChange={(value) => setValue('sortBy', value as any)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={watch('sortOrder')}
                  onValueChange={(value) => setValue('sortOrder', value as any)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Low to High</SelectItem>
                    <SelectItem value="desc">High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Search Button */}
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
              Search Barbers
            </>
          )}
        </Button>
      </form>
    </SearchErrorBoundary>
  );
}