'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CalendarDays, Clock, User, Scissors, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCreateBooking } from '@/hooks/bookings/useBookings';
import { useBarberAvailability } from '@/hooks/bookings/useBookings';
import { useUIStore } from '@/stores/uiStore';
import { BookingErrorBoundary } from '@/components/ErrorBoundary/FeatureErrorBoundary';
import { BarberProfileDetailsResponseDTO, AvailabilityResponseDTO } from '@/lib/api/types/api-dtos';

const bookingSchema = z.object({
  serviceId: z.string().min(1, 'Please select a service'),
  scheduledTime: z.string().min(1, 'Please select a time slot'),
  notes: z.string().optional(),
  paymentMethodId: z.string().optional(),
  reminderPreferences: z.object({
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
    push: z.boolean().default(true),
  }).optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  barber: BarberProfileDetailsResponseDTO;
  selectedDate: Date;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

export function BookingForm({
  barber,
  selectedDate,
  onSuccess,
  onCancel,
}: BookingFormProps) {
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const router = useRouter();

  const createBookingMutation = useCreateBooking();
  const uiStore = useUIStore();

  // Get availability for selected service and date
  const { data: availability, isLoading: isLoadingAvailability } = useBarberAvailability({
    barberId: barber.id,
    serviceId: selectedService,
    date: selectedDate.toISOString().split('T')[0] || '',
  }) as { data: AvailabilityResponseDTO | undefined; isLoading: boolean };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema) as any,
    defaultValues: {
      reminderPreferences: {
        email: true,
        sms: false,
        push: true,
      },
    },
  });


  const selectedServiceDetails = barber.services.find(s => s.id === selectedService);

  const onSubmit = async (data: BookingFormData) => {
    try {
      const result = await createBookingMutation.mutateAsync({
        barberId: barber.id,
        serviceId: data.serviceId,
        scheduledTime: data.scheduledTime,
        ...(data.notes && { notes: data.notes }),
        ...(data.paymentMethodId && { paymentMethodId: data.paymentMethodId }),
        ...(data.reminderPreferences && { reminderPreferences: data.reminderPreferences }),
      } as any);

      uiStore.addToast({
        type: 'success',
        title: 'Booking Created!',
        message: 'Your appointment has been scheduled successfully.',
      });

      onSuccess?.(result.id);
      router.push(`/bookings/${result.id}/confirmation`);
    } catch (error: any) {
      setError('root', {
        message: error.message || 'Failed to create booking. Please try again.',
      });

      uiStore.addToast({
        type: 'error',
        title: 'Booking Failed',
        message: error.message || 'Please try again or contact support.',
      });
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
    setSelectedTimeSlot('');
    setValue('serviceId', serviceId);
    setValue('scheduledTime', '');
  };

  const handleTimeSlotSelect = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot);
    setValue('scheduledTime', timeSlot);
  };

  return (
    <BookingErrorBoundary>
      <div className="space-y-6">
        {/* Barber Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Booking with {barber.businessName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{barber.address}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary">{barber.rating} ⭐</Badge>
                  <span className="text-sm text-muted-foreground">
                    {barber.reviewCount} reviews
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  <CalendarDays className="w-4 h-4 inline mr-1" />
                  {selectedDate.toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
          {/* Service Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5" />
                Select Service
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {barber.services
                  .filter(service => service.isActive)
                  .map((service) => (
                    <div
                      key={service.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedService === service.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => handleServiceSelect(service.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{service.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {service.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{service.duration} min</Badge>
                            {service.category && (
                              <Badge variant="secondary">{service.category}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${service.price}</p>
                          {selectedService === service.id && (
                            <Check className="w-5 h-5 text-primary mt-1" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              {errors.serviceId && (
                <p className="text-sm text-destructive mt-2">{errors.serviceId.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Time Slot Selection */}
          {selectedService && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Select Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAvailability ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Loading available times...</span>
                  </div>
                ) : availability?.timeSlots.length ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availability.timeSlots
                      .filter(slot => slot.available)
                      .map((slot) => {
                        const startTime = new Date(slot.start);
                        const timeString = startTime.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <Button
                            key={slot.start}
                            type="button"
                            variant={selectedTimeSlot === slot.start ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleTimeSlotSelect(slot.start)}
                          >
                            {timeString}
                          </Button>
                        );
                      })}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No available time slots for this date. Please select a different date.
                    </AlertDescription>
                  </Alert>
                )}
                {errors.scheduledTime && (
                  <p className="text-sm text-destructive mt-2">{errors.scheduledTime.message}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Additional Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Any special requests or notes for your barber..."
                {...register('notes')}
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Reminder Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Reminder Preferences</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    id="emailReminder"
                    type="checkbox"
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    {...register('reminderPreferences.email')}
                  />
                  <Label htmlFor="emailReminder">Email reminder (24 hours before)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="smsReminder"
                    type="checkbox"
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    {...register('reminderPreferences.sms')}
                  />
                  <Label htmlFor="smsReminder">SMS reminder (2 hours before)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="pushReminder"
                    type="checkbox"
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                    {...register('reminderPreferences.push')}
                  />
                  <Label htmlFor="pushReminder">Push notification (1 hour before)</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Booking Summary */}
          {selectedService && selectedTimeSlot && (
            <Card>
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Service:</span>
                    <span className="font-medium">{selectedServiceDetails?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span>{selectedServiceDetails?.duration} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{selectedDate.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time:</span>
                    <span>
                      {new Date(selectedTimeSlot).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>${selectedServiceDetails?.price}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Alert */}
          {errors.root && (
            <Alert variant="destructive">
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || createBookingMutation.isPending || !selectedService || !selectedTimeSlot}
              className="flex-1"
            >
              {isSubmitting || createBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Booking...
                </>
              ) : (
                'Book Appointment'
              )}
            </Button>
          </div>
        </form>
      </div>
    </BookingErrorBoundary>
  );
}