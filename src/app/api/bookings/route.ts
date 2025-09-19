import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import stripe from '@/lib/stripe'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { validateBookingData } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined)
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = verifyToken(token)
    const { customerId, barberId, serviceId, dateTime } = await request.json()

    // Validate request data
    const validation = validateBookingData({ customerId, barberId, serviceId, dateTime })
    if (!validation.isValid) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 })
    }

    // Verify customer matches authenticated user
    if (customerId !== user.id) {
      return NextResponse.json({ error: 'Cannot book for another user' }, { status: 403 })
    }

    // Get service details
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        barber: true
      }
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (service.barberId !== barberId) {
      return NextResponse.json({ error: 'Service does not belong to specified barber' }, { status: 400 })
    }

    const bookingDateTime = new Date(dateTime)
    const endTime = new Date(bookingDateTime.getTime() + service.duration * 60000)

    // Check availability: no overlapping bookings for barber
    const existingBooking = await prisma.booking.findFirst({
      where: {
        barberId,
        status: { not: 'canceled' },
        OR: [
          {
            dateTime: {
              lte: bookingDateTime,
            },
            AND: {
              dateTime: {
                gte: new Date(bookingDateTime.getTime() - service.duration * 60000)
              }
            }
          },
          {
            dateTime: {
              gte: bookingDateTime,
              lt: endTime
            }
          }
        ]
      }
    })

    if (existingBooking) {
      return NextResponse.json({ error: 'Time slot unavailable' }, { status: 400 })
    }

    const totalAmount = service.price

    // Create booking with pending payment status
    const booking = await prisma.booking.create({
      data: {
        customerId,
        barberId,
        serviceId,
        dateTime: bookingDateTime,
        totalAmount,
        status: 'scheduled',
        paymentStatus: 'pending'
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        barber: {
          select: {
            businessName: true
          }
        },
        service: {
          select: {
            name: true,
            duration: true
          }
        }
      }
    })

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalAmount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        bookingId: booking.id,
        customerId: booking.customerId,
        barberId: booking.barberId,
        serviceId: booking.serviceId
      },
      automatic_payment_methods: {
        enabled: true
      }
    })

    return NextResponse.json({
      booking: {
        id: booking.id,
        dateTime: booking.dateTime,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        totalAmount: booking.totalAmount,
        customer: booking.customer,
        barber: booking.barber,
        service: booking.service
      },
      clientSecret: paymentIntent.client_secret
    }, { status: 201 })

  } catch (error) {
    console.error('Booking creation error:', error)
    return NextResponse.json({ error: 'Booking creation failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined)
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = verifyToken(token)
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Build filter conditions based on user role
    const whereConditions: Record<string, unknown> = {}

    if (user.role === 'customer') {
      whereConditions.customerId = user.id
    } else if (user.role === 'barber') {
      // Find barber profile for this user
      const barberProfile = await prisma.barberProfile.findUnique({
        where: { userId: user.id }
      })
      if (!barberProfile) {
        return NextResponse.json({ error: 'Barber profile not found' }, { status: 404 })
      }
      whereConditions.barberId = barberProfile.id
    } else {
      // Admin can see all bookings
    }

    if (status) {
      whereConditions.status = status
    }

    const bookings = await prisma.booking.findMany({
      where: whereConditions,
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        barber: {
          select: {
            businessName: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true
              }
            }
          }
        },
        service: {
          select: {
            name: true,
            duration: true,
            category: true
          }
        },
        payment: true,
        review: true
      },
      orderBy: {
        dateTime: 'desc'
      }
    })

    return NextResponse.json({ bookings }, { status: 200 })

  } catch (error) {
    console.error('Booking fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }
}