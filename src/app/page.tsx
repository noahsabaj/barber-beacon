'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Scissors, MapPin, Calendar, Star } from 'lucide-react'

export default function Home() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="-mt-8">
      {/* Hero Section with Barber Pole Pattern */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-barber-charcoal to-barber-charcoal-light">
          {/* Subtle Barber Pole Stripes */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                #C41E3A,
                #C41E3A 10px,
                #FFFFFF 10px,
                #FFFFFF 20px,
                #1E3A5F 20px,
                #1E3A5F 30px,
                #FFFFFF 30px,
                #FFFFFF 40px
              )`,
            }}
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-barber-gold/10 border border-barber-gold/20 rounded-full px-4 py-2 mb-6">
              <Scissors className="w-4 h-4 text-barber-gold" />
              <span className="text-sm font-medium text-barber-gold">Premium Barber Network</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-barber-cream">Find Your</span>
              <br />
              <span className="text-barber-gold">Perfect Cut</span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl text-barber-cream/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect with master barbers in your area. Real-time booking, authentic reviews,
              and the guarantee of a premium grooming experience.
            </p>

            {/* CTA Buttons */}
            {!isAuthenticated ? (
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/auth/register"
                  className="bg-barber-gold text-barber-charcoal px-8 py-4 rounded-md text-lg font-semibold hover:bg-barber-gold-light transition-all hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Book Your First Cut
                </Link>
                <Link
                  href="/barbers"
                  className="border-2 border-barber-gold/50 text-barber-cream px-8 py-4 rounded-md text-lg font-semibold hover:bg-barber-gold/10 transition-all"
                >
                  Browse Barbers
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link
                  href="/barbers"
                  className="bg-barber-gold text-barber-charcoal px-8 py-4 rounded-md text-lg font-semibold hover:bg-barber-gold-light transition-all hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Find Barbers Near You
                </Link>
                <Link
                  href="/bookings"
                  className="border-2 border-barber-gold/50 text-barber-cream px-8 py-4 rounded-md text-lg font-semibold hover:bg-barber-gold/10 transition-all"
                >
                  My Appointments
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-barber-charcoal mb-4">
              The <span className="text-barber-gold">Premium</span> Experience
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We're not just another booking platform. We're your gateway to exceptional grooming.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="group text-center p-6 rounded-xl hover:bg-barber-cream transition-all duration-300">
              <div className="w-16 h-16 bg-barber-gold/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-barber-gold/20 transition-colors">
                <MapPin className="w-8 h-8 text-barber-gold" />
              </div>
              <h3 className="text-xl font-semibold text-barber-charcoal mb-3">
                Location Intelligence
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Smart proximity search finds the best barbers near you. Real-time availability and distance tracking.
              </p>
            </div>

            <div className="group text-center p-6 rounded-xl hover:bg-barber-cream transition-all duration-300">
              <div className="w-16 h-16 bg-barber-red/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-barber-red/20 transition-colors">
                <Calendar className="w-8 h-8 text-barber-red" />
              </div>
              <h3 className="text-xl font-semibold text-barber-charcoal mb-3">
                Instant Booking
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Book your cut in seconds. 15-minute precision slots, automated confirmations, and SMS reminders.
              </p>
            </div>

            <div className="group text-center p-6 rounded-xl hover:bg-barber-cream transition-all duration-300">
              <div className="w-16 h-16 bg-barber-navy/10 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:bg-barber-navy/20 transition-colors">
                <Star className="w-8 h-8 text-barber-navy" />
              </div>
              <h3 className="text-xl font-semibold text-barber-charcoal mb-3">
                Verified Quality
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Authentic reviews from real customers. Portfolio showcases and certified master barbers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-20 bg-barber-charcoal">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="group">
              <div className="text-5xl font-bold text-barber-gold mb-2 group-hover:scale-110 transition-transform">
                500+
              </div>
              <div className="text-barber-cream/80 text-lg">Master Barbers</div>
            </div>
            <div className="group">
              <div className="text-5xl font-bold text-barber-red mb-2 group-hover:scale-110 transition-transform">
                10,000+
              </div>
              <div className="text-barber-cream/80 text-lg">Perfect Cuts</div>
            </div>
            <div className="group">
              <div className="text-5xl font-bold text-barber-gold mb-2 group-hover:scale-110 transition-transform">
                4.8★
              </div>
              <div className="text-barber-cream/80 text-lg">Client Satisfaction</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-barber-gold to-barber-gold-dark rounded-2xl p-12 text-center shadow-2xl">
            <h2 className="text-4xl font-bold text-barber-charcoal mb-4">
              Your Next Great Cut Awaits
            </h2>
            <p className="text-xl text-barber-charcoal/80 mb-8 max-w-2xl mx-auto">
              Join the elite grooming experience. Book with verified professionals who take pride in their craft.
            </p>
            {!isAuthenticated ? (
              <Link
                href="/auth/register"
                className="inline-block bg-barber-charcoal text-barber-cream px-8 py-4 rounded-md text-lg font-semibold hover:bg-barber-charcoal-dark transition-all hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Join Barber Beacon
              </Link>
            ) : (
              <Link
                href="/barbers"
                className="inline-block bg-barber-charcoal text-barber-cream px-8 py-4 rounded-md text-lg font-semibold hover:bg-barber-charcoal-dark transition-all hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Book Your Appointment
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}