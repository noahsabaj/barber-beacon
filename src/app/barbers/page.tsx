'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import dynamic from 'next/dynamic'
import LocationSearch from '@/components/LocationSearch'
import { Search, MapPin, Star, Clock, DollarSign, Filter } from 'lucide-react'

// Dynamically import LocationMap to avoid SSR issues
const LocationMap = dynamic(() => import('@/components/LocationMap'), {
  ssr: false,
  loading: () => <div className="h-96 w-full bg-gray-200 animate-pulse rounded-lg" />
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
  user: {
    firstName: string
    lastName: string
  }
  services: {
    id: string
    name: string
    price: number
    duration: number
    category: string
  }[]
  reviews?: {
    rating: number
  }[]
  distance?: number
}

export default function BarbersPage() {
  const [barbers, setBarbers] = useState<BarberProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [searchLocation, setSearchLocation] = useState<{lat: number, lng: number} | null>(null)
  const [filters, setFilters] = useState({
    service: 'all',
    minRating: 'all',
    maxDistance: '25',
    sortBy: 'distance'
  })

  const searchBarbers = async (lat: number, lng: number) => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lng: lng.toString(),
        radius: filters.maxDistance,
        ...(filters.service !== 'all' && { service: filters.service }),
        ...(filters.minRating !== 'all' && { minRating: filters.minRating }),
        sortBy: filters.sortBy
      })

      const response = await fetch(`/api/barbers?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch barbers')
      }

      const data = await response.json()
      setBarbers(data.barbers || [])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleLocationSelect = (lat: number, lng: number) => {
    setSearchLocation({ lat, lng })
    searchBarbers(lat, lng)
  }

  const calculateAverageRating = (reviews: { rating: number }[] = []) => {
    if (!reviews.length) return 0
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
  }

  const getMapMarkers = () => {
    return barbers.map(barber => ({
      position: [barber.location.lat, barber.location.lng] as [number, number],
      popup: `${barber.businessName} - $${barber.services[0]?.price || 'N/A'}`
    }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Find Professional Barbers Near You
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover skilled barbers in your area, compare services, and book appointments instantly.
            </p>
          </div>

          {/* Search Section */}
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search Barbers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Location Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <LocationSearch
                    onLocationSelect={handleLocationSelect}
                    placeholder="Enter your address or location..."
                  />
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Type
                    </label>
                    <Select
                      value={filters.service}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, service: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any service" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any service</SelectItem>
                        <SelectItem value="haircut">Haircut</SelectItem>
                        <SelectItem value="beard-trim">Beard Trim</SelectItem>
                        <SelectItem value="shave">Shave</SelectItem>
                        <SelectItem value="styling">Styling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Min Rating
                    </label>
                    <Select
                      value={filters.minRating}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, minRating: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any rating" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any rating</SelectItem>
                        <SelectItem value="4">4+ stars</SelectItem>
                        <SelectItem value="4.5">4.5+ stars</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Distance
                    </label>
                    <Select
                      value={filters.maxDistance}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, maxDistance: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">Within 5 miles</SelectItem>
                        <SelectItem value="10">Within 10 miles</SelectItem>
                        <SelectItem value="25">Within 25 miles</SelectItem>
                        <SelectItem value="50">Within 50 miles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sort By
                    </label>
                    <Select
                      value={filters.sortBy}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="distance">Distance</SelectItem>
                        <SelectItem value="rating">Rating</SelectItem>
                        <SelectItem value="price">Price</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Apply Filters Button */}
                {searchLocation && (
                  <Button
                    onClick={() => searchBarbers(searchLocation.lat, searchLocation.lng)}
                    className="w-full"
                    disabled={loading}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {loading ? 'Searching...' : 'Apply Filters'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert className="mb-6" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {searchLocation && !loading && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {barbers.length} barbers found near you
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Barber List */}
              <div className="lg:col-span-2 space-y-6">
                {barbers.map((barber) => {
                  const avgRating = calculateAverageRating(barber.reviews)
                  const lowestPrice = Math.min(...barber.services.map(s => s.price))

                  return (
                    <Card key={barber.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-xl font-bold text-gray-900">
                                {barber.businessName}
                              </h3>
                              {avgRating > 0 && (
                                <div className="flex items-center gap-1">
                                  <Star className="h-4 w-4 text-yellow-400 fill-current" />
                                  <span className="text-sm font-medium">
                                    {avgRating.toFixed(1)}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    ({barber.reviews?.length || 0} reviews)
                                  </span>
                                </div>
                              )}
                            </div>

                            <p className="text-gray-600 mb-2">
                              {barber.user.firstName} {barber.user.lastName}
                            </p>

                            {barber.bio && (
                              <p className="text-gray-600 mb-4 line-clamp-2">
                                {barber.bio}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                              {barber.distance && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  {barber.distance.toFixed(1)} miles away
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-4 w-4" />
                                From ${lowestPrice}
                              </div>
                            </div>

                            {/* Services Preview */}
                            <div className="mb-4">
                              <div className="flex flex-wrap gap-2">
                                {barber.services.slice(0, 3).map((service) => (
                                  <span
                                    key={service.id}
                                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                                  >
                                    {service.name} - ${service.price}
                                  </span>
                                ))}
                                {barber.services.length > 3 && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                                    +{barber.services.length - 3} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <Button asChild className="flex-1">
                            <Link href={`/barbers/${barber.id}`}>
                              View Profile
                            </Link>
                          </Button>
                          <Button variant="outline" asChild>
                            <Link href={`/barbers/${barber.id}/book`}>
                              Book Now
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}

                {barbers.length === 0 && !loading && searchLocation && (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        No barbers found
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Try adjusting your search criteria or expanding your search radius.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setFilters(prev => ({ ...prev, maxDistance: '50', service: 'all', minRating: 'all' }))}
                      >
                        Clear Filters
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Map */}
              {searchLocation && (
                <div className="lg:col-span-1">
                  <Card className="sticky top-4">
                    <CardHeader>
                      <CardTitle>Map View</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <LocationMap
                        center={[searchLocation.lat, searchLocation.lng]}
                        zoom={12}
                        markers={getMapMarkers()}
                        className="h-96 w-full"
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}

        {!searchLocation && !loading && (
          <div className="text-center py-12">
            <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Start by searching for your location
            </h3>
            <p className="text-gray-600">
              Enter your address above to find barbers near you.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}