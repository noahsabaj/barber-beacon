'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import Logo from '@/components/Logo'

export default function Navigation() {
  const { user, isAuthenticated, logout } = useAuth()

  return (
    <nav className="bg-barber-charcoal shadow-lg border-b border-barber-gold/20">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-18 py-3">
          {/* Logo */}
          <Logo size="md" />

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/barbers" className="text-barber-cream hover:text-barber-gold transition-colors font-medium">
              Find Barbers
            </Link>
            {isAuthenticated && (
              <>
                {user?.role === 'customer' && (
                  <Link href="/dashboard" className="text-barber-cream hover:text-barber-gold transition-colors font-medium">
                    My Bookings
                  </Link>
                )}
                {user?.role === 'barber' && (
                  <Link href="/barber-dashboard" className="text-barber-cream hover:text-barber-gold transition-colors font-medium">
                    Dashboard
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            {isAuthenticated && (
              <Link
                href={user?.role === 'barber' ? '/barber-dashboard' : '/dashboard'}
                className="text-barber-cream hover:text-barber-gold transition-colors text-sm font-medium"
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-barber-cream/80 font-medium">
                  Welcome, {user?.firstName || user?.email}
                </span>
                <button
                  onClick={logout}
                  className="bg-barber-red text-white px-5 py-2 rounded-md hover:bg-barber-red-dark transition-all hover:shadow-lg font-medium"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/auth/login"
                  className="text-barber-cream hover:text-barber-gold transition-colors font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-barber-gold text-barber-charcoal px-5 py-2 rounded-md hover:bg-barber-gold-light transition-all hover:shadow-lg font-semibold"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}