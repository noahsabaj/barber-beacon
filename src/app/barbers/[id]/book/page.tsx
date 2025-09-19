'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Calendar as CalendarIcon, Clock, DollarSign } from 'lucide-react'

interface Service {
  id: string
  name: string
  description?: string
  price: number
  duration: number
  category: string
}

interface BarberProfile {
  id: string
  businessName: string
  user: {
    firstName: string
    lastName: string
  }
  services: Service[]
}

const bookingSchema = z.object({
  serviceId: z.string().min(1, 'Please select a service'),
  date: z.date({
    message: 'Please select a date',
  }),
  time: z.string().min(1, 'Please select a time'),
})

type BookingForm = z.infer<typeof bookingSchema>

export default function BookingPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useAuth()

  const [barber, setBarber] = useState<BarberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [isBooking, setIsBooking] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>()

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      serviceId: searchParams.get('serviceId') || '',
      date: undefined,
      time: '',
    },
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/auth/login?redirect=/barbers/${params.id}/book`)
      return
    }

    fetchBarberProfile()
  }, [params.id, isAuthenticated])

  useEffect(() => {
    if (selectedDate) {
      generateTimeSlots(selectedDate)
    }
  }, [selectedDate, form.watch('serviceId')])

  const fetchBarberProfile = async () => {
    try {
      const response = await fetch(`/api/barbers/${params.id}`)
      if (!response.ok) {
        throw new Error('Barber not found')
      }
      const data = await response.json()
      setBarber(data.barber)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load barber profile')
    } finally {
      setLoading(false)
    }
  }

  const generateTimeSlots = (date: Date) => {
    // Simple time slot generation - 9 AM to 6 PM, 15-minute intervals
    const slots: string[] = []
    const startHour = 9
    const endHour = 18

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(timeString)
      }
    }

    // TODO: Filter out already booked slots by checking existing bookings
    setAvailableSlots(slots)
  }

  const onSubmit = async (data: BookingForm) => {
    if (!user || !barber) return

    setIsBooking(true)
    setError('')

    try {
      const selectedService = barber.services.find(s => s.id === data.serviceId)
      if (!selectedService) {
        throw new Error('Selected service not found')
      }

      // Combine date and time
      const [hours, minutes] = data.time.split(':').map(Number)
      const bookingDateTime = new Date(data.date)
      bookingDateTime.setHours(hours, minutes, 0, 0)

      const bookingData = {
        customerId: user.id,
        barberId: barber.id,
        serviceId: data.serviceId,
        dateTime: bookingDateTime.toISOString(),
      }

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(bookingData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Booking failed')
      }

      // Redirect to payment or confirmation
      if (result.clientSecret) {
        // Redirect to payment page with client secret
        router.push(`/booking/payment?bookingId=${result.booking.id}&clientSecret=${result.clientSecret}`)
      } else {
        // Redirect to confirmation
        router.push(`/booking/confirmation?bookingId=${result.booking.id}`)
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Booking failed')
    } finally {
      setIsBooking(false)
    }
  }

  const selectedService = barber?.services.find(s => s.id === form.watch('serviceId'))

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking page...</p>
        </div>
      </div>
    )
  }

  if (error || !barber) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Unable to Book</h1>
          <p className="text-gray-600 mb-6">{error || 'Barber not found.'}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Book an Appointment
          </h1>
          <p className="text-gray-600">
            with {barber.businessName} - {barber.user.firstName} {barber.user.lastName}
          </p>
        </div>

        {error && (
          <Alert className="mb-6" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Select Service & Time</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* Service Selection */}
                    <FormField
                      control={form.control}
                      name="serviceId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Service</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose a service" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {barber.services.map((service) => (
                                <SelectItem key={service.id} value={service.id}>
                                  <div className="flex justify-between items-center w-full">
                                    <span>{service.name}</span>
                                    <span className="ml-4 text-gray-500">
                                      ${service.price} • {service.duration}min
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Date Selection */}
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Select Date</FormLabel>
                          <FormControl>
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date)
                                setSelectedDate(date)
                              }}
                              disabled={(date) =>
                                date < new Date() || date < new Date("1900-01-01")
                              }
                              className="rounded-md border"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Time Selection */}
                    {selectedDate && (
                      <FormField
                        control={form.control}
                        name="time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Time</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a time" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-48">
                                {availableSlots.map((slot) => (
                                  <SelectItem key={slot} value={slot}>
                                    {slot}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={isBooking || !selectedService}
                    >
                      {isBooking ? 'Booking...' : `Book Appointment - $${selectedService?.price || 0}`}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Summary Sidebar */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{barber.businessName}</h3>
                  <p className="text-gray-600">
                    {barber.user.firstName} {barber.user.lastName}
                  </p>
                </div>

                {selectedService && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Service</h4>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{selectedService.name}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {selectedService.duration} minutes
                        </p>
                      </div>
                      <p className="text-lg font-bold">${selectedService.price}</p>
                    </div>
                  </div>
                )}

                {form.watch('date') && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Date & Time</h4>
                    <div className="flex items-center gap-2 text-gray-600">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{form.watch('date')?.toLocaleDateString()}</span>
                    </div>
                    {form.watch('time') && (
                      <div className="flex items-center gap-2 text-gray-600 mt-1">
                        <Clock className="h-4 w-4" />
                        <span>{form.watch('time')}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total</span>
                    <span>${selectedService?.price || 0}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Payment will be processed after booking confirmation
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}