'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import Logo from '@/components/Logo'

export default function Navigation() {
  const { user, isAuthenticated, logout } = useAuth()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/80 backdrop-blur-lg shadow-lg'
        : 'bg-white/60 backdrop-blur-md'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16 py-3">
          {/* Logo */}
          <Logo size="sm" />

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/barbers" className="text-barber-charcoal/80 hover:text-barber-gold transition-colors font-medium">
              Find Barbers
            </Link>
            {isAuthenticated && (
              <>
                {user?.role === 'customer' && (
                  <Link href="/dashboard" className="text-barber-charcoal/80 hover:text-barber-gold transition-colors font-medium">
                    My Bookings
                  </Link>
                )}
                {user?.role === 'barber' && (
                  <Link href="/barber-dashboard" className="text-barber-charcoal/80 hover:text-barber-gold transition-colors font-medium">
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
                className="text-barber-charcoal/80 hover:text-barber-gold transition-colors text-sm font-medium"
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <span className="text-barber-charcoal/60 font-medium text-sm">
                  Welcome, {user?.firstName || user?.email}
                </span>
                <button
                  onClick={logout}
                  className="bg-barber-charcoal/10 text-barber-charcoal px-4 py-2 rounded-lg hover:bg-barber-charcoal/20 transition-all font-medium text-sm"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  href="/auth/login"
                  className="text-barber-charcoal/80 hover:text-barber-gold transition-colors font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-barber-charcoal text-white px-5 py-2 rounded-lg hover:bg-barber-charcoal-dark transition-all hover:shadow-lg font-semibold"
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