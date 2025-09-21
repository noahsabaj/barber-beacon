'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Clock,
  MapPin,
  Scissors,
  Phone,
  MessageSquare,
  MoreVertical,
  Check,
  X,
  Edit,
  Star,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateBooking, useCancelBooking } from '@/hooks/bookings/useBookings';
import { useUIStore } from '@/stores/uiStore';
import { useAuthSelectors } from '@/stores/authStore';
import { BookingResponseDTO } from '@/lib/api/types/api-dtos';
import { BookingErrorBoundary } from '@/components/ErrorBoundary/FeatureErrorBoundary';

interface BookingCardProps {
  booking: BookingResponseDTO;
  onUpdate?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export function BookingCard({
  booking,
  onUpdate,
  onCancel,
  showActions = true,
  compact = false,
}: BookingCardProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const router = useRouter();
  const { userRole } = useAuthSelectors();
  const uiStore = useUIStore();

  const updateBookingMutation = useUpdateBooking();
  const cancelBookingMutation = useCancelBooking();

  const scheduledTime = new Date(booking.scheduledTime);
  const isUpcoming = scheduledTime > new Date();
  const isToday = scheduledTime.toDateString() === new Date().toDateString();

  const getStatusColor = () => {
    switch (booking.status) {
      case 'CONFIRMED':
        return 'bg-green-500';
      case 'PENDING_CONFIRMATION':
      case 'PENDING_PAYMENT':
        return 'bg-yellow-500';
      case 'IN_PROGRESS':
        return 'bg-indigo-500';
      case 'COMPLETED':
        return 'bg-blue-500';
      case 'CANCELLED':
        return 'bg-red-500';
      case 'NO_SHOW':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = () => {
    switch (booking.status) {
      case 'CONFIRMED':
        return 'Confirmed';
      case 'PENDING_CONFIRMATION':
        return 'Pending Confirmation';
      case 'PENDING_PAYMENT':
        return 'Pending Payment';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'No Show';
      default:
        return booking.status;
    }
  };

  const canCancel = () => {
    return (
      booking.status === 'CONFIRMED' ||
      booking.status === 'PENDING_CONFIRMATION'
    ) && isUpcoming;
  };

  const canReschedule = () => {
    return (
      booking.status === 'CONFIRMED' ||
      booking.status === 'PENDING_CONFIRMATION'
    ) && isUpcoming;
  };

  const canComplete = () => {
    return userRole === 'BARBER' && booking.status === 'CONFIRMED' && !isUpcoming;
  };

  const canReview = () => {
    return userRole === 'CUSTOMER' && booking.status === 'COMPLETED' && !booking.review;
  };

  const handleCancel = async () => {
    try {
      await cancelBookingMutation.mutateAsync({
        bookingId: booking.id,
        reason: 'User requested cancellation',
      });

      uiStore.addToast({
        type: 'success',
        title: 'Booking Cancelled',
        message: 'Your appointment has been cancelled successfully.',
      });

      setShowCancelConfirm(false);
      onCancel?.(booking.id);
    } catch (error: any) {
      uiStore.addToast({
        type: 'error',
        title: 'Cancellation Failed',
        message: error.message || 'Failed to cancel booking. Please try again.',
      });
    }
  };

  const handleComplete = async () => {
    try {
      await updateBookingMutation.mutateAsync({
        bookingId: booking.id,
        updates: { status: 'COMPLETED' },
      });

      uiStore.addToast({
        type: 'success',
        title: 'Booking Completed',
        message: 'The appointment has been marked as completed.',
      });

      onUpdate?.(booking.id);
    } catch (error: any) {
      uiStore.addToast({
        type: 'error',
        title: 'Update Failed',
        message: error.message || 'Failed to update booking. Please try again.',
      });
    }
  };

  const handleReschedule = () => {
    router.push(`/bookings/${booking.id}/reschedule`);
  };

  const handleViewDetails = () => {
    router.push(`/bookings/${booking.id}`);
  };

  const handleWriteReview = () => {
    router.push(`/bookings/${booking.id}/review`);
  };

  const handleContact = () => {
    if (userRole === 'CUSTOMER' && booking.barber.phoneNumber) {
      window.open(`tel:${booking.barber.phoneNumber}`);
    } else if (userRole === 'BARBER' && booking.user.phoneNumber) {
      window.open(`tel:${booking.user.phoneNumber}`);
    }
  };

  const handleMessage = () => {
    // Open messaging interface
    router.push(`/messages?booking=${booking.id}`);
  };

  if (compact) {
    return (
      <BookingErrorBoundary>
        <Card className="w-full">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
                <div>
                  <p className="font-medium">
                    {userRole === 'CUSTOMER' ? booking.barber.businessName : `${booking.user.firstName} ${booking.user.lastName}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {scheduledTime.toLocaleDateString()} at {scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline">{getStatusLabel()}</Badge>
                <p className="text-sm font-medium mt-1">${booking.totalPrice}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </BookingErrorBoundary>
    );
  }

  return (
    <BookingErrorBoundary>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage
                  src={userRole === 'CUSTOMER' ? booking.barber.portfolioImages?.[0] : undefined}
                  alt={userRole === 'CUSTOMER' ? booking.barber.businessName : `${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim() || 'User'}
                />
                <AvatarFallback>
                  {userRole === 'CUSTOMER'
                    ? booking.barber.businessName.substring(0, 2).toUpperCase()
                    : `${booking.user.firstName?.charAt(0) || ''}${booking.user.lastName?.charAt(0) || ''}`.toUpperCase() || 'U'
                  }
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">
                  {userRole === 'CUSTOMER' ? booking.barber.businessName : `${booking.user.firstName || ''} ${booking.user.lastName || ''}`.trim() || 'User'}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="outline" className={getStatusColor().replace('bg-', 'border-')}>
                    {getStatusLabel()}
                  </Badge>
                  {isToday && (
                    <Badge variant="secondary">Today</Badge>
                  )}
                </div>
              </div>
            </div>

            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleViewDetails}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>

                  {canReschedule() && (
                    <DropdownMenuItem onClick={handleReschedule}>
                      <Edit className="mr-2 h-4 w-4" />
                      Reschedule
                    </DropdownMenuItem>
                  )}

                  {canComplete() && (
                    <DropdownMenuItem onClick={handleComplete}>
                      <Check className="mr-2 h-4 w-4" />
                      Mark Complete
                    </DropdownMenuItem>
                  )}

                  {canReview() && (
                    <DropdownMenuItem onClick={handleWriteReview}>
                      <Star className="mr-2 h-4 w-4" />
                      Write Review
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={handleContact}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={handleMessage}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Message
                  </DropdownMenuItem>

                  {canCancel() && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowCancelConfirm(true)}
                        className="text-destructive"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel Booking
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Service Information */}
          <div className="flex items-center space-x-3">
            <Scissors className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{booking.service.name}</p>
              <p className="text-sm text-muted-foreground">
                {booking.duration} minutes • ${booking.totalPrice}
              </p>
            </div>
          </div>

          {/* Date and Time */}
          <div className="flex items-center space-x-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {scheduledTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                <Clock className="h-3 w-3 inline mr-1" />
                {scheduledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Location */}
          {userRole === 'CUSTOMER' && (
            <div className="flex items-center space-x-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm">{booking.barber.address}</p>
                <p className="text-sm text-muted-foreground">
                  {booking.barber.city}, {booking.barber.state} {booking.barber.zipCode}
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm">
                <strong>Notes:</strong> {booking.notes}
              </p>
            </div>
          )}

          {/* Review */}
          {booking.review && (
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{booking.review.rating}/5</span>
              </div>
              {booking.review.comment && (
                <p className="text-sm">{booking.review.comment}</p>
              )}
            </div>
          )}

          {/* Cancellation Reason */}
          {booking.status === 'CANCELLED' && booking.cancellationReason && (
            <Alert>
              <AlertDescription>
                <strong>Cancelled:</strong> {booking.cancellationReason}
              </AlertDescription>
            </Alert>
          )}

          {/* Cancel Confirmation */}
          {showCancelConfirm && (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="space-y-3">
                  <p>Are you sure you want to cancel this appointment?</p>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleCancel}
                      disabled={cancelBookingMutation.isPending}
                    >
                      {cancelBookingMutation.isPending ? 'Cancelling...' : 'Yes, Cancel'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCancelConfirm(false)}
                    >
                      Keep Booking
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </BookingErrorBoundary>
  );
}