import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashPassword, validateEmail, validatePassword } from '@/lib/auth'
import { signToken } from '@/lib/jwt'
import { VALIDATION_RULES } from '@/lib/validation-constants'

export async function POST(request: NextRequest) {
  try {
    const { email, password, role, firstName, lastName, phone, address } = await request.json()

    // Validation
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    if (!validatePassword(password)) {
      return NextResponse.json(
        { error: VALIDATION_RULES.PASSWORD.ERROR_MESSAGE },
        { status: 400 }
      )
    }

    if (role && !['customer', 'barber', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 })
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || 'customer',
        firstName,
        lastName,
        phone,
        address
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        createdAt: true
      }
    })

    // Generate JWT token
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role
    })

    return NextResponse.json({ user, token }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}