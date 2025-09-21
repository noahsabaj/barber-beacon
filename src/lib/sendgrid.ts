import sgMail from '@sendgrid/mail'
import prisma from './prisma'

if (!process.env['SENDGRID_API_KEY']) {
  throw new Error('SENDGRID_API_KEY is required')
}

sgMail.setApiKey(process.env['SENDGRID_API_KEY']!)

export async function sendConfirmationEmail(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        barber: { include: { user: true } },
        service: true
      }
    })

    if (!booking || !booking.customer.email) {
      throw new Error('Booking or customer email not found')
    }

    const msg = {
      to: booking.customer.email,
      from: process.env['SENDGRID_FROM_EMAIL'] || 'noreply@barberbeacon.com',
      subject: 'Booking Confirmation - Barber Beacon',
      html: `
        <h2>Booking Confirmed!</h2>
        <p>Hi ${booking.customer.firstName},</p>
        <p>Your booking has been confirmed with the following details:</p>
        <ul>
          <li><strong>Barber:</strong> ${booking.barber.businessName}</li>
          <li><strong>Service:</strong> ${booking.service.name}</li>
          <li><strong>Date & Time:</strong> ${new Date(booking.scheduledTime).toLocaleString()}</li>
          <li><strong>Total Amount:</strong> $${booking.totalAmount}</li>
        </ul>
        <p>Thank you for choosing Barber Beacon!</p>
      `
    }

    await sgMail.send(msg)
    console.log('Email confirmation sent for booking:', bookingId)
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

export async function sendReminderEmail(bookingId: string) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        barber: { include: { user: true } },
        service: true
      }
    })

    if (!booking || !booking.customer.email) {
      throw new Error('Booking or customer email not found')
    }

    const msg = {
      to: booking.customer.email,
      from: process.env['SENDGRID_FROM_EMAIL'] || 'noreply@barberbeacon.com',
      subject: 'Appointment Reminder - Barber Beacon',
      html: `
        <h2>Appointment Reminder</h2>
        <p>Hi ${booking.customer.firstName},</p>
        <p>This is a reminder that you have an appointment tomorrow:</p>
        <ul>
          <li><strong>Barber:</strong> ${booking.barber.businessName}</li>
          <li><strong>Service:</strong> ${booking.service.name}</li>
          <li><strong>Date & Time:</strong> ${new Date(booking.scheduledTime).toLocaleString()}</li>
        </ul>
        <p>See you tomorrow!</p>
      `
    }

    await sgMail.send(msg)
    console.log('Email reminder sent for booking:', bookingId)
  } catch (error) {
    console.error('Failed to send email reminder:', error)
    throw error
  }
}