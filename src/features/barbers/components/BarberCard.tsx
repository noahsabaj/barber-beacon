'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Star,
  Phone,
  Globe,
  Instagram,
  Clock,
  Heart,
  Eye,
  Calendar,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFavoriteBarber } from '@/hooks/barbers/useBarbers';
import { useAuthSelectors } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { SearchBarbersResponseDTO } from '@/lib/api/types/api-dtos';
import { SearchErrorBoundary } from '@/components/ErrorBoundary/FeatureErrorBoundary';

interface BarberCardProps {
  barber: SearchBarbersResponseDTO['barbers'][0];
  onBook?: (barberId: string) => void;
  onViewProfile?: (barberId: string) => void;
  showDistance?: boolean;
  compact?: boolean;
}

export function BarberCard({
  barber,
  onBook,
  onViewProfile,
  showDistance = true,
  compact = false,
}: BarberCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const router = useRouter();
  const { isLoggedIn } = useAuthSelectors();
  const uiStore = useUIStore();

  const favoriteMutation = useFavoriteBarber();

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isLoggedIn) {
      uiStore.addToast({
        type: 'warning',
        title: 'Login Required',
        message: 'Please log in to favorite barbers.',
      });
      return;
    }

    try {
      await favoriteMutation.mutateAsync({
        barberId: barber.id,
        action: isFavorited ? 'remove' : 'add',
      });

      setIsFavorited(!isFavorited);

      uiStore.addToast({
        type: 'success',
        title: isFavorited ? 'Removed from Favorites' : 'Added to Favorites',
        message: `${barber.businessName} has been ${isFavorited ? 'removed from' : 'added to'} your favorites.`,
      });
    } catch (error: any) {
      uiStore.addToast({
        type: 'error',
        title: 'Failed to Update Favorites',
        message: error.message || 'Please try again.',
      });
    }
  };

  const handleBook = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBook) {
      onBook(barber.id);
    } else {
      router.push(`/barbers/${barber.id}/book`);
    }
  };

  const handleViewProfile = () => {
    if (onViewProfile) {
      onViewProfile(barber.id);
    } else {
      router.push(`/barbers/${barber.id}`);
    }
  };

  const handleGetDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    const address = encodeURIComponent(`${barber.address}, ${barber.city}, ${barber.state}`);
    window.open(`https://maps.google.com/?q=${address}`, '_blank');
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (barber.phoneNumber) {
      window.open(`tel:${barber.phoneNumber}`);
    }
  };

  const handleWebsite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (barber.website) {
      window.open(barber.website, '_blank');
    }
  };

  const handleInstagram = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (barber.instagramHandle) {
      window.open(`https://instagram.com/${barber.instagramHandle}`, '_blank');
    }
  };

  if (compact) {
    return (
      <SearchErrorBoundary>
        <Card
          className="w-full cursor-pointer hover:shadow-md transition-shadow"
          onClick={handleViewProfile}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={barber.portfolioImages?.[0]}
                  alt={barber.businessName}
                />
                <AvatarFallback>
                  {barber.businessName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{barber.businessName}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex items-center">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm ml-1">{barber.rating}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ({barber.reviewCount})
                  </span>
                  {showDistance && barber.distance && (
                    <span className="text-xs text-muted-foreground">
                      • {barber.distance.toFixed(1)} mi
                    </span>
                  )}
                </div>
              </div>

              <Button size="sm" onClick={handleBook}>
                Book
              </Button>
            </div>
          </CardContent>
        </Card>
      </SearchErrorBoundary>
    );
  }

  return (
    <SearchErrorBoundary>
      <Card
        className="w-full cursor-pointer hover:shadow-lg transition-all duration-200 group"
        onClick={handleViewProfile}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={barber.portfolioImages?.[0]}
                  alt={barber.businessName}
                />
                <AvatarFallback className="text-lg">
                  {barber.businessName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div>
                <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                  {barber.businessName}
                </h3>

                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium ml-1">{barber.rating}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    ({barber.reviewCount} reviews)
                  </span>
                  {barber.matchScore && (
                    <Badge variant="secondary">
                      {barber.matchScore}% match
                    </Badge>
                  )}
                </div>

                <div className="flex items-center mt-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3 mr-1" />
                  <span className="truncate max-w-[200px]">
                    {barber.address}, {barber.city}
                  </span>
                  {showDistance && barber.distance && (
                    <span className="ml-2 font-medium">
                      {barber.distance.toFixed(1)} mi
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleFavorite}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Heart
                className={`h-4 w-4 ${
                  isFavorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
                }`}
              />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Description */}
          {barber.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {barber.description}
            </p>
          )}

          {/* Specialties */}
          {barber.specialties && barber.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {barber.specialties.slice(0, 4).map((specialty) => (
                <Badge key={specialty} variant="outline" className="text-xs">
                  {specialty}
                </Badge>
              ))}
              {barber.specialties.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{barber.specialties.length - 4} more
                </Badge>
              )}
            </div>
          )}

          {/* Amenities */}
          {barber.amenities && barber.amenities.length > 0 && (
            <div className="flex items-center space-x-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {barber.amenities.slice(0, 3).join(' • ')}
                {barber.amenities.length > 3 && ' +more'}
              </span>
            </div>
          )}

          {/* Portfolio Images Preview */}
          {barber.portfolioImages && barber.portfolioImages.length > 1 && (
            <div className="flex space-x-2 overflow-hidden">
              {barber.portfolioImages.slice(1, 4).map((image, index) => (
                <div
                  key={index}
                  className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden"
                >
                  <img
                    src={image}
                    alt={`${barber.businessName} work ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              {barber.portfolioImages.length > 4 && (
                <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">
                    +{barber.portfolioImages.length - 4}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewProfile}
              >
                <Eye className="h-3 w-3 mr-1" />
                View Profile
              </Button>

              {barber.phoneNumber && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCall}
                >
                  <Phone className="h-3 w-3" />
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleGetDirections}
              >
                <Navigation className="h-3 w-3" />
              </Button>

              {barber.website && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWebsite}
                >
                  <Globe className="h-3 w-3" />
                </Button>
              )}

              {barber.instagramHandle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInstagram}
                >
                  <Instagram className="h-3 w-3" />
                </Button>
              )}
            </div>

            <Button onClick={handleBook}>
              <Calendar className="h-3 w-3 mr-1" />
              Book Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </SearchErrorBoundary>
  );
}