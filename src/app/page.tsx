'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function Home() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-20">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Find Your Perfect Barber
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Connect with professional barbers in your area. Book appointments, view portfolios,
          and leave reviews all in one place.
        </p>

        {!isAuthenticated ? (
          <div className="flex justify-center space-x-4">
            <Link
              href="/auth/register"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/barbers"
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Browse Barbers
            </Link>
          </div>
        ) : (
          <div className="flex justify-center space-x-4">
            <Link
              href="/barbers"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Find Barbers
            </Link>
            <Link
              href="/bookings"
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              My Bookings
            </Link>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="py-20 bg-white rounded-lg shadow-sm">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose Barber Beacon?</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            We make it easy to find, book, and connect with professional barbers in your area.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 px-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Location-Based Search</h3>
            <p className="text-gray-600">
              Find barbers within your preferred radius with real-time distance calculations.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-Time Booking</h3>
            <p className="text-gray-600">
              Book appointments instantly with 15-minute time slot granularity and automated confirmations.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Integrated Payments</h3>
            <p className="text-gray-600">
              Secure payment processing with Stripe - no third-party redirects or hidden fees.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-20 text-center">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-4xl font-bold text-blue-600 mb-2">500+</div>
            <div className="text-gray-600">Professional Barbers</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-green-600 mb-2">10,000+</div>
            <div className="text-gray-600">Happy Customers</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-600 mb-2">4.8★</div>
            <div className="text-gray-600">Average Rating</div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 text-white rounded-lg p-12 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-xl mb-8 opacity-90">
          Join thousands of satisfied customers and find your perfect barber today.
        </p>
        {!isAuthenticated ? (
          <Link
            href="/auth/register"
            className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Sign Up Now
          </Link>
        ) : (
          <Link
            href="/barbers"
            className="bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Find Barbers Near You
          </Link>
        )}
      </div>
    </div>
  )
}