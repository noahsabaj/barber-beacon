import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'
import { validateReviewData } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const reviewId = params.id

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
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
                name: true,
                category: true
              }
            }
          }
        }
      }
    })

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    return NextResponse.json({ review }, { status: 200 })

  } catch (error) {
    console.error('Review fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch review' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const token = extractTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = verifyToken(token)
    const reviewId = params.id
    const { rating, comment } = await request.json()

    // Validate review data
    const validation = validateReviewData({ rating, comment })
    if (!validation.isValid) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 })
    }

    // Get existing review
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId }
    })

    if (!existingReview) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Verify ownership
    if (existingReview.customerId !== user.id) {
      return NextResponse.json({ error: 'Not authorized to update this review' }, { status: 403 })
    }

    // Check if review is recent (allow updates within 24 hours)
    const reviewAge = Date.now() - existingReview.createdAt.getTime()
    const twentyFourHours = 24 * 60 * 60 * 1000

    if (reviewAge > twentyFourHours) {
      return NextResponse.json({ error: 'Reviews can only be updated within 24 hours' }, { status: 400 })
    }

    // Update review
    const updatedReview = await prisma.review.update({
      where: { id: reviewId },
      data: {
        rating,
        comment: comment || null,
        updatedAt: new Date()
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
                name: true,
                category: true
              }
            }
          }
        }
      }
    })

    return NextResponse.json({ review: updatedReview }, { status: 200 })

  } catch (error) {
    console.error('Review update error:', error)
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify authentication
    const token = extractTokenFromHeader(request.headers.get('authorization'))
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = verifyToken(token)
    const reviewId = params.id

    // Get existing review
    const existingReview = await prisma.review.findUnique({
      where: { id: reviewId }
    })

    if (!existingReview) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Verify ownership or admin role
    if (existingReview.customerId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized to delete this review' }, { status: 403 })
    }

    // Delete review
    await prisma.review.delete({
      where: { id: reviewId }
    })

    return NextResponse.json({ message: 'Review deleted successfully' }, { status: 200 })

  } catch (error) {
    console.error('Review deletion error:', error)
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 })
  }
}