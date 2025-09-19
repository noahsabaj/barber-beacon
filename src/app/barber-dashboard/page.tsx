'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import {
  Calendar,
  Clock,
  DollarSign,
  Users,
  TrendingUp,
  Settings,
  Plus,
  Star,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface BarberProfile {
  id: string
  businessName: string
  bio?: string
  location: any
  hourlyRate?: number
  workingHours: any
  services: Service[]
}

interface Service {
  id: string
  name: string
  description?: string
  price: number
  duration: number
  category: string
}

interface Booking {
  id: string
  dateTime: string
  status: 'scheduled' | 'completed' | 'canceled'
  paymentStatus: 'pending' | 'completed' | 'failed'
  totalAmount: number
  customer: {
    firstName: string
    lastName: string
    email: string
    phone?: string
  }
  service: {
    name: string
    duration: number
  }
}

export default function BarberDashboard() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isOnboarding = searchParams.get('onboarding') === 'true'

  const [barberProfile, setBarberProfile] = useState<BarberProfile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    if (user?.role !== 'barber') {
      router.push('/dashboard')
      return
    }

    fetchBarberData()
  }, [isAuthenticated, user])

  const fetchBarberData = async () => {
    try {
      // Fetch barber profile
      const profileResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        setBarberProfile(profileData.user.barberProfile)
      }

      // Fetch bookings
      const bookingsResponse = await fetch('/api/bookings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json()
        setBookings(bookingsData.bookings || [])
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        // Refresh bookings
        fetchBarberData()
      }
    } catch (error) {
      console.error('Failed to update booking:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'canceled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const todayBookings = bookings.filter(b => {
    const bookingDate = new Date(b.dateTime).toDateString()
    const today = new Date().toDateString()
    return bookingDate === today && b.status === 'scheduled'
  })

  const upcomingBookings = bookings.filter(b =>
    b.status === 'scheduled' && new Date(b.dateTime) > new Date()
  )

  const completedBookings = bookings.filter(b => b.status === 'completed')
  const totalRevenue = completedBookings.reduce((sum, b) => sum + b.totalAmount, 0)
  const avgRating = 4.8 // TODO: Calculate from reviews

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Show onboarding message for new barbers
  if (isOnboarding || !barberProfile) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Welcome to Barber Beacon!</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-6">
                You're almost ready to start accepting bookings. Complete your barber profile to get started.
              </p>
              <Alert className="mb-6">
                <AlertDescription>
                  Set up your business profile, add services, and configure your working hours to start receiving bookings.
                </AlertDescription>
              </Alert>
              <div className="flex justify-center gap-4">
                <Button asChild>
                  <Link href="/barber-dashboard/setup">
                    Complete Profile Setup
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => router.push('/barber-dashboard?onboarding=false')}>
                  Skip for Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {barberProfile?.businessName || 'Business Dashboard'}
              </h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user?.firstName}! Here's your business overview
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/barber-dashboard/services">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/barber-dashboard/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert className="mb-6" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Today's Bookings</p>
                  <p className="text-2xl font-bold text-gray-900">{todayBookings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Clients</p>
                  <p className="text-2xl font-bold text-gray-900">{completedBookings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">${totalRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Star className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                  <p className="text-2xl font-bold text-gray-900">{avgRating}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Bookings Management */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Manage Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="today" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="today">Today ({todayBookings.length})</TabsTrigger>
                    <TabsTrigger value="upcoming">Upcoming ({upcomingBookings.length})</TabsTrigger>
                    <TabsTrigger value="all">All Bookings</TabsTrigger>
                  </TabsList>

                  <TabsContent value="today" className="mt-6">
                    {todayBookings.length > 0 ? (
                      <div className="space-y-4">
                        {todayBookings.map((booking) => (
                          <div key={booking.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                              <Avatar>
                                <AvatarFallback>
                                  {booking.customer.firstName[0]}{booking.customer.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium">
                                  {booking.customer.firstName} {booking.customer.lastName}
                                </h4>
                                <p className="text-sm text-gray-600">{booking.service.name}</p>
                                <p className="text-sm text-gray-500">
                                  {new Date(booking.dateTime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })} • {booking.service.duration}min
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge className={getStatusColor(booking.status)}>
                                {booking.status}
                              </Badge>
                              <span className="font-bold">${booking.totalAmount}</span>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => updateBookingStatus(booking.id, 'completed')}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateBookingStatus(booking.id, 'canceled')}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No bookings today
                        </h3>
                        <p className="text-gray-600">You have a free day!</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="upcoming" className="mt-6">
                    {upcomingBookings.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {upcomingBookings.slice(0, 10).map((booking) => (
                            <TableRow key={booking.id}>
                              <TableCell>
                                {booking.customer.firstName} {booking.customer.lastName}
                              </TableCell>
                              <TableCell>{booking.service.name}</TableCell>
                              <TableCell>
                                {new Date(booking.dateTime).toLocaleString()}
                              </TableCell>
                              <TableCell>${booking.totalAmount}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(booking.status)}>
                                  {booking.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8">
                        <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No upcoming bookings
                        </h3>
                        <p className="text-gray-600">Check back later for new appointments.</p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="all" className="mt-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings.slice(0, 10).map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell>
                              {booking.customer.firstName} {booking.customer.lastName}
                            </TableCell>
                            <TableCell>{booking.service.name}</TableCell>
                            <TableCell>
                              {new Date(booking.dateTime).toLocaleString()}
                            </TableCell>
                            <TableCell>${booking.totalAmount}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(booking.status)}>
                                {booking.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Services */}
          <div className="space-y-6">
            {/* Services */}
            <Card>
              <CardHeader>
                <CardTitle>Your Services</CardTitle>
              </CardHeader>
              <CardContent>
                {barberProfile?.services && barberProfile.services.length > 0 ? (
                  <div className="space-y-3">
                    {barberProfile.services.slice(0, 5).map((service) => (
                      <div key={service.id} className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-sm text-gray-600">{service.duration}min</p>
                        </div>
                        <span className="font-bold">${service.price}</span>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full mt-4" asChild>
                      <Link href="/barber-dashboard/services">
                        Manage Services
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">No services added yet</p>
                    <Button asChild>
                      <Link href="/barber-dashboard/services">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Service
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" asChild>
                  <Link href="/barber-dashboard/calendar">
                    <Calendar className="h-4 w-4 mr-2" />
                    View Calendar
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/barber-dashboard/services">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Service
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/barber-dashboard/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Business Settings
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