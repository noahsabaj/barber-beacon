import { NextRequest, NextResponse } from 'next/server'
import stripe from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined)
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = verifyToken(token)
    const { paymentIntentId } = await request.json()

    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Payment intent ID is required' }, { status: 400 })
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (!paymentIntent) {
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 })
    }

    const bookingId = paymentIntent.metadata['bookingId']

    if (!bookingId) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 })
    }

    // Get booking and verify ownership
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        barber: {
          select: {
            businessName: true
          }
        },
        service: {
          select: {
            name: true
          }
        },
        payment: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.customerId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to view this payment' }, { status: 403 })
    }

    return NextResponse.json({
      payment: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        created: new Date(paymentIntent.created * 1000)
      },
      booking: {
        id: booking.id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        dateTime: booking.scheduledTime,
        totalAmount: booking.totalAmount,
        customer: booking.customer,
        barber: booking.barber,
        service: booking.service
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Payment confirmation error:', error)
    return NextResponse.json({ error: 'Payment confirmation failed' }, { status: 500 })
  }
}