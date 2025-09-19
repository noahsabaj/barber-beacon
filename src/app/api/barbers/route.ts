import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')
    const radius = parseFloat(searchParams.get('radius') || '25')
    const service = searchParams.get('service')
    const minPrice = parseFloat(searchParams.get('minPrice') || '0')
    const maxPrice = parseFloat(searchParams.get('maxPrice') || '1000')

    // Validate location parameter
    if (!location) {
      return NextResponse.json({ error: 'Location parameter is required (format: lat,lng)' }, { status: 400 })
    }

    const [latStr, lngStr] = location.split(',')
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'Invalid location format. Use: lat,lng' }, { status: 400 })
    }

    // Validate radius
    if (radius < 1 || radius > 25) {
      return NextResponse.json({ error: 'Radius must be between 1 and 25 miles' }, { status: 400 })
    }

    // Build filter conditions
    const whereConditions: any = {}

    if (service) {
      whereConditions.services = {
        some: {
          category: service
        }
      }
    }

    // Get all barber profiles with services
    const allBarbers = await prisma.barberProfile.findMany({
      where: whereConditions,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        services: {
          where: {
            price: {
              gte: minPrice,
              lte: maxPrice
            }
          }
        },
        reviews: {
          select: {
            rating: true
          }
        }
      }
    })

    // Filter by distance and calculate average rating
    const barbersWithinRadius = allBarbers.filter(barber => {
      const barberLocation = barber.location as { lat: number; lng: number }
      const distance = calculateDistance(lat, lng, barberLocation.lat, barberLocation.lng)
      return distance <= radius
    }).map(barber => {
      const barberLocation = barber.location as { lat: number; lng: number }
      const distance = calculateDistance(lat, lng, barberLocation.lat, barberLocation.lng)

      // Calculate average rating
      const ratings = barber.reviews.map(review => review.rating)
      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : 0

      return {
        id: barber.id,
        businessName: barber.businessName,
        bio: barber.bio,
        location: barber.location,
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
        hourlyRate: barber.hourlyRate,
        portfolio: barber.portfolio,
        workingHours: barber.workingHours,
        averageRating: Math.round(averageRating * 10) / 10,
        reviewCount: barber.reviews.length,
        services: barber.services,
        contact: {
          firstName: barber.user.firstName,
          lastName: barber.user.lastName,
          phone: barber.user.phone
        }
      }
    })

    // Sort by distance
    barbersWithinRadius.sort((a, b) => a.distance - b.distance)

    return NextResponse.json({
      barbers: barbersWithinRadius,
      total: barbersWithinRadius.length,
      searchCriteria: {
        location: { lat, lng },
        radius,
        service,
        priceRange: { min: minPrice, max: maxPrice }
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Barber search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}