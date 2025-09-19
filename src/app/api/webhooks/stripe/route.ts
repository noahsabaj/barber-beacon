import { NextRequest, NextResponse } from 'next/server'
import stripe from '@/lib/stripe'
import prisma from '@/lib/prisma'
import { sendConfirmationSMS } from '@/lib/twilio'
import { sendConfirmationEmail } from '@/lib/sendgrid'

interface StripePaymentIntent {
  id: string
  amount: number
  metadata: {
    bookingId?: string
    customerId?: string
    barberId?: string
    serviceId?: string
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No Stripe signature found' }, { status: 400 })
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
    }

    let event

    try {
      event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('Webhook signature verification failed:', errorMessage)
      return NextResponse.json({ error: `Webhook Error: ${errorMessage}` }, { status: 400 })
    }

    console.log('Received Stripe webhook event:', event.type)

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as StripePaymentIntent
        console.log('Payment succeeded:', paymentIntent.id)

        const bookingId = paymentIntent.metadata.bookingId

        if (!bookingId) {
          console.error('No booking ID found in payment intent metadata')
          return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 })
        }

        // Create payment record
        await prisma.payment.create({
          data: {
            bookingId,
            amount: paymentIntent.amount / 100, // Convert from cents
            stripePaymentId: paymentIntent.id,
            status: 'succeeded'
          }
        })

        // Update booking payment status
        const updatedBooking = await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: 'paid',
            status: 'scheduled'
          },
          include: {
            customer: true,
            barber: true,
            service: true
          }
        })

        // Send confirmation notifications
        try {
          if (updatedBooking.customer.phone) {
            await sendConfirmationSMS(bookingId)
          }
          if (updatedBooking.customer.email) {
            await sendConfirmationEmail(bookingId)
          }
        } catch (notificationError) {
          console.error('Failed to send confirmation notifications:', notificationError)
          // Don't fail the webhook for notification errors
        }

        console.log('Booking updated successfully:', bookingId)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as StripePaymentIntent
        console.log('Payment failed:', paymentIntent.id)

        const bookingId = paymentIntent.metadata.bookingId

        if (bookingId) {
          // Create payment record with failed status
          await prisma.payment.create({
            data: {
              bookingId,
              amount: paymentIntent.amount / 100,
              stripePaymentId: paymentIntent.id,
              status: 'failed'
            }
          })

          // Update booking payment status
          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              paymentStatus: 'failed',
              status: 'canceled'
            }
          })

          console.log('Booking marked as failed:', bookingId)
        }
        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as StripePaymentIntent
        console.log('Payment canceled:', paymentIntent.id)

        const bookingId = paymentIntent.metadata.bookingId

        if (bookingId) {
          // Update booking status
          await prisma.booking.update({
            where: { id: bookingId },
            data: {
              paymentStatus: 'failed',
              status: 'canceled'
            }
          })

          console.log('Booking canceled:', bookingId)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true }, { status: 200 })

  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}