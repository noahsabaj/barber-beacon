'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, Calendar, Clock, User, Phone } from 'lucide-react'

interface BookingDetails {
  id: string
  dateTime: string
  status: string
  paymentStatus: string
  totalAmount: number
  customer: {
    firstName: string
    lastName: string
    email: string
    phone?: string
  }
  barber: {
    businessName: string
    user: {
      firstName: string
      lastName: string
      phone?: string
    }
  }
  service: {
    name: string
    duration: number
  }
}

function BookingConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookingId = searchParams.get('bookingId')

  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided')
      setLoading(false)
      return
    }

    fetchBookingDetails()
  }, [bookingId])

  const fetchBookingDetails = async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch booking details')
      }

      const data = await response.json()
      setBooking(data.booking)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load booking details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error || 'Booking not found'}</AlertDescription>
          </Alert>
          <Button onClick={() => router.push('/dashboard')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Booking Confirmed!
          </h1>
          <p className="text-gray-600">
            Your appointment has been successfully booked.
          </p>
        </div>

        {/* Booking Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Appointment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Service & Barber Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Service</h3>
                <div className="space-y-2">
                  <p className="text-lg font-medium">{booking.service.name}</p>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{booking.service.duration} minutes</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <span className="text-2xl font-bold text-gray-900">
                      ${booking.totalAmount}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Barber</h3>
                <div className="space-y-2">
                  <p className="text-lg font-medium">{booking.barber.businessName}</p>
                  <p className="text-gray-600">
                    {booking.barber.user.firstName} {booking.barber.user.lastName}
                  </p>
                  {booking.barber.user.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{booking.barber.user.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Date & Time</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">{new Date(booking.dateTime).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</p>
                    <p className="text-sm text-gray-600">Date</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Clock className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">{new Date(booking.dateTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</p>
                    <p className="text-sm text-gray-600">Time</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Status</h3>
              <div className="flex gap-3">
                <Badge className="bg-blue-100 text-blue-800">
                  {booking.status}
                </Badge>
                <Badge className={
                  booking.paymentStatus === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }>
                  Payment {booking.paymentStatus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Important Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Important Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Confirmation sent:</strong> You will receive a confirmation email and SMS
                with your appointment details.
              </AlertDescription>
            </Alert>

            <Alert>
              <AlertDescription>
                <strong>Reminder:</strong> You'll receive a reminder 24 hours before your appointment.
              </AlertDescription>
            </Alert>

            {booking.paymentStatus === 'pending' && (
              <Alert>
                <AlertDescription>
                  <strong>Payment:</strong> Your payment is being processed. You'll receive
                  confirmation once completed.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertDescription>
                <strong>Cancellation:</strong> You can cancel or reschedule your appointment
                up to 2 hours before the scheduled time.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="text-center space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                <User className="h-4 w-4 mr-2" />
                View My Bookings
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/barbers">
                <Calendar className="h-4 w-4 mr-2" />
                Book Another Appointment
              </Link>
            </Button>
          </div>

          <p className="text-sm text-gray-500">
            Booking ID: {booking.id}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <BookingConfirmationContent />
    </Suspense>
  )
}