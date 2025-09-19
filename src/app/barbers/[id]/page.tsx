'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Star, MapPin, Clock, DollarSign, Phone, Calendar, ArrowLeft } from 'lucide-react'

// Dynamically import LocationMap to avoid SSR issues
const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
  loading: () => <div className="h-64 w-full bg-gray-200 animate-pulse rounded-lg" />
})

interface BarberProfile {
  id: string
  businessName: string
  bio?: string
  location: {
    lat: number
    lng: number
    address?: string
  }
  hourlyRate?: number
  portfolio: string[]
  workingHours: any
  user: {
    firstName: string
    lastName: string
    phone?: string
  }
  services: {
    id: string
    name: string
    description?: string
    price: number
    duration: number
    category: string
  }[]
}

interface Review {
  id: string
  rating: number
  comment?: string
  createdAt: string
  customer: {
    firstName: string
    lastName: string
  }
  booking: {
    service: {
      name: string
    }
  }
}

export default function BarberProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [barber, setBarber] = useState<BarberProfile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const fetchBarberProfile = async () => {
      if (!params.id) return

      try {
        // Fetch barber profile
        const barberResponse = await fetch(`/api/barbers/${params.id}`)
        if (!barberResponse.ok) {
          throw new Error('Barber not found')
        }
        const barberData = await barberResponse.json()
        setBarber(barberData.barber)

        // Fetch reviews
        const reviewsResponse = await fetch(`/api/reviews?barberId=${params.id}`)
        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json()
          setReviews(reviewsData.reviews || [])
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load barber profile')
      } finally {
        setLoading(false)
      }
    }

    fetchBarberProfile()
  }, [params.id])

  const calculateAverageRating = () => {
    if (!reviews.length) return 0
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${
          index < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ))
  }

  const formatWorkingHours = (workingHours: any) => {
    if (!workingHours) return 'Hours not specified'

    // Simple formatting - could be enhanced based on actual data structure
    if (typeof workingHours === 'string') return workingHours
    if (typeof workingHours === 'object') {
      return Object.entries(workingHours)
        .map(([day, hours]) => `${day}: ${hours}`)
        .join(', ')
    }
    return 'Hours not specified'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading barber profile...</p>
        </div>
      </div>
    )
  }

  if (error || !barber) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Barber Not Found</h1>
          <p className="text-gray-600 mb-6">{error || 'This barber profile does not exist.'}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  const avgRating = calculateAverageRating()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Profile */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <Card>
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                      {barber.businessName}
                    </h1>
                    <p className="text-xl text-gray-600">
                      {barber.user.firstName} {barber.user.lastName}
                    </p>
                    {avgRating > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex">{renderStars(avgRating)}</div>
                        <span className="text-lg font-medium">{avgRating.toFixed(1)}</span>
                        <span className="text-gray-500">({reviews.length} reviews)</span>
                      </div>
                    )}
                  </div>
                  <Button size="lg" asChild>
                    <Link href={`/barbers/${barber.id}/book`}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Book Appointment
                    </Link>
                  </Button>
                </div>

                {barber.bio && (
                  <p className="text-gray-700 text-lg leading-relaxed">{barber.bio}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
                  {barber.user.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>{barber.user.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{formatWorkingHours(barber.workingHours)}</span>
                  </div>
                  {barber.hourlyRate && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <DollarSign className="h-4 w-4" />
                      <span>${barber.hourlyRate}/hour</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Services */}
            <Card>
              <CardHeader>
                <CardTitle>Services & Pricing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {barber.services.map((service) => (
                    <div
                      key={service.id}
                      className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div>
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        {service.description && (
                          <p className="text-gray-600 text-sm mt-1">{service.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {service.duration} min
                          </span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {service.category}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">${service.price}</div>
                        <Button size="sm" asChild>
                          <Link href={`/barbers/${barber.id}/book?serviceId=${service.id}`}>
                            Book This
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Reviews */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Reviews ({reviews.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {reviews.length > 0 ? (
                  <div className="space-y-6">
                    {reviews.slice(0, 5).map((review) => (
                      <div key={review.id} className="border-b pb-4 last:border-b-0">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">
                                {review.customer.firstName} {review.customer.lastName}
                              </span>
                              <div className="flex">{renderStars(review.rating)}</div>
                            </div>
                            <p className="text-sm text-gray-500">
                              Service: {review.booking.service.name}
                            </p>
                          </div>
                          <span className="text-sm text-gray-500">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-gray-700">{review.comment}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">
                    No reviews yet. Be the first to leave a review!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Location Map */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LocationMap
                  center={[barber.location.lat, barber.location.lng]}
                  zoom={15}
                  markers={[{
                    position: [barber.location.lat, barber.location.lng],
                    popup: barber.businessName
                  }]}
                  className="h-64 w-full mb-4"
                />
                {barber.location.address && (
                  <p className="text-sm text-gray-600">{barber.location.address}</p>
                )}
              </CardContent>
            </Card>

            {/* Quick Book */}
            <Card>
              <CardHeader>
                <CardTitle>Book an Appointment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Ready to book? Choose your service and preferred time.
                </p>
                <Button className="w-full" size="lg" asChild>
                  <Link href={`/barbers/${barber.id}/book`}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Book Now
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}