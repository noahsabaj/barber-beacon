import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { validateReviewData } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined)
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = verifyToken(token)
    const { bookingId, rating, comment } = await request.json()

    // Validate review data
    const validation = validateReviewData({ rating, comment })
    if (!validation.isValid) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 })
    }

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
    }

    // Get booking and verify conditions
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        review: true,
        barber: true
      }
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify the customer owns this booking
    if (booking.customerId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to review this booking' }, { status: 403 })
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return NextResponse.json({ error: 'Only completed bookings can be reviewed' }, { status: 400 })
    }

    // Check if review already exists
    if (booking.review) {
      return NextResponse.json({ error: 'Booking has already been reviewed' }, { status: 400 })
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        customerId: user.id,
        barberId: booking.barberId,
        bookingId,
        rating,
        comment: comment || null
      },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        barber: {
          select: {
            businessName: true
          }
        },
        booking: {
          select: {
            dateTime: true,
            service: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ review }, { status: 201 })

  } catch (error) {
    console.error('Review creation error:', error)
    return NextResponse.json({ error: 'Review creation failed' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const barberId = searchParams.get('barberId')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    const whereConditions: Record<string, unknown> = {}

    if (barberId) {
      whereConditions.barberId = barberId
    }

    const reviews = await prisma.review.findMany({
      where: whereConditions,
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        booking: {
          select: {
            dateTime: true,
            service: {
              select: {
                name: true,
                category: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset
    })

    // Calculate statistics if barberId is provided
    let statistics = null
    if (barberId) {
      const allReviews = await prisma.review.findMany({
        where: { barberId },
        select: { rating: true }
      })

      if (allReviews.length > 0) {
        const totalRating = allReviews.reduce((sum, review) => sum + review.rating, 0)
        const averageRating = totalRating / allReviews.length

        const ratingDistribution = {
          1: allReviews.filter(r => r.rating === 1).length,
          2: allReviews.filter(r => r.rating === 2).length,
          3: allReviews.filter(r => r.rating === 3).length,
          4: allReviews.filter(r => r.rating === 4).length,
          5: allReviews.filter(r => r.rating === 5).length
        }

        statistics = {
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews: allReviews.length,
          ratingDistribution
        }
      }
    }

    return NextResponse.json({
      reviews,
      statistics,
      pagination: {
        limit,
        offset,
        hasMore: reviews.length === limit
      }
    }, { status: 200 })

  } catch (error) {
    console.error('Review fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}