import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyToken, extractTokenFromHeader } from '@/lib/jwt'

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get('authorization') || undefined)

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }

    const decoded = verifyToken(token)

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        barberProfile: {
          include: {
            services: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Remove password from response
    const userWithoutPassword = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      address: user.address,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      barberProfile: user.barberProfile
    }

    return NextResponse.json({ user: userWithoutPassword }, { status: 200 })
  } catch (error) {
    console.error('Auth verification error:', error)
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}