import twilio from 'twilio'
import prisma from './prisma'

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  throw new Error('Twilio credentials are required')
}

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

export async function sendConfirmationSMS(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        barber: { include: { user: true } },
        service: true
      }
    })

    if (!booking || !booking.customer.phone) {
      throw new Error('Booking or customer phone not found')
    }

    const message = `Your booking with ${booking.barber.businessName} for ${booking.service.name} on ${new Date(booking.dateTime).toLocaleString()} is confirmed! Total: $${booking.totalAmount}`

    await client.messages.create({
      body: message,
      to: booking.customer.phone,
      from: process.env.TWILIO_PHONE_NUMBER
    })

    console.log('SMS confirmation sent for booking:', bookingId)
  } catch (error) {
    console.error('Failed to send SMS:', error)
    throw error
  }
}

export async function sendReminderSMS(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        barber: { include: { user: true } },
        service: true
      }
    })

    if (!booking || !booking.customer.phone) {
      throw new Error('Booking or customer phone not found')
    }

    const message = `Reminder: You have an appointment with ${booking.barber.businessName} tomorrow at ${new Date(booking.dateTime).toLocaleTimeString()}`

    await client.messages.create({
      body: message,
      to: booking.customer.phone,
      from: process.env.TWILIO_PHONE_NUMBER
    })

    console.log('SMS reminder sent for booking:', bookingId)
  } catch (error) {
    console.error('Failed to send SMS reminder:', error)
    throw error
  }
}