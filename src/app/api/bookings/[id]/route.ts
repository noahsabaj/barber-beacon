import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined)
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = verifyToken(token)
    const bookingId = params.id

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        },
        barber: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true
              }
            }
          }
        },
        service: true,
        payment: true,
        review: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check if user has permission to view this booking
    const hasPermission =
      user.role === 'admin' ||
      booking.customerId === user.id ||
      (user.role === 'barber' && booking.barber.userId === user.id)

    if (!hasPermission) {
      return NextResponse.json({ error: 'Not authorized to view this booking' }, { status: 403 })
    }

    return NextResponse.json({ booking }, { status: 200 })

  } catch (error) {
    console.error('Booking fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined)
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = verifyToken(token)
    const bookingId = params.id
    const { status } = await request.json()

    // Validate status
    const validStatuses = ['scheduled', 'completed', 'canceled']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        barber: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Check permissions for status updates
    let hasPermission = false

    if (user.role === 'admin') {
      hasPermission = true
    } else if (status === 'canceled' && booking.customerId === user.id) {
      // Customers can cancel their own bookings
      hasPermission = true
    } else if (status === 'completed' && user.role === 'barber' && booking.barber.userId === user.id) {
      // Barbers can mark their bookings as completed
      hasPermission = true
    }

    if (!hasPermission) {
      return NextResponse.json({ error: 'Not authorized to update this booking' }, { status: 403 })
    }

    // Additional business logic checks
    if (status === 'completed' && booking.status !== 'scheduled') {
      return NextResponse.json({ error: 'Only scheduled bookings can be marked as completed' }, { status: 400 })
    }

    if (status === 'canceled' && booking.dateTime < new Date()) {
      return NextResponse.json({ error: 'Cannot cancel past bookings' }, { status: 400 })
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
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
        service: true,
        payment: true
      }
    })

    return NextResponse.json({ booking: updatedBooking }, { status: 200 })

  } catch (error) {
    console.error('Booking update error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
}