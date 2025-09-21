'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowRight, MapPin, Clock, Shield, Star, Calendar, ChevronRight, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function Home() {
  const { isAuthenticated } = useAuth()
  const [scrollY, setScrollY] = useState(0)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('scroll', handleScroll)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <div className="relative">
      {/* Hero Section - Clean and Modern */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-white via-barber-cream/30 to-white">
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          {/* Floating Orbs */}
          <div
            className="absolute top-20 left-10 w-96 h-96 bg-barber-gold/10 rounded-full blur-3xl"
            style={{
              transform: `translate(${mousePosition.x * 0.01}px, ${mousePosition.y * 0.01}px)`
            }}
          />
          <div
            className="absolute bottom-20 right-10 w-96 h-96 bg-barber-red/5 rounded-full blur-3xl"
            style={{
              transform: `translate(${-mousePosition.x * 0.01}px, ${-mousePosition.y * 0.01}px)`
            }}
          />

          {/* Subtle Grid Pattern */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #1C1C1C 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}
          />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Animated Badge */}
          <div
            className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border border-barber-gold/20 rounded-full px-5 py-2 mb-8 shadow-sm hover:shadow-md transition-all cursor-default"
            style={{
              transform: `translateY(${scrollY * -0.1}px)`
            }}
          >
            <Sparkles className="w-4 h-4 text-barber-gold animate-pulse" />
            <span className="text-sm font-medium bg-gradient-to-r from-barber-gold to-barber-gold-dark bg-clip-text text-transparent">
              Trusted by 10,000+ Clients
            </span>
          </div>

          {/* Main Headline with Better Typography */}
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight">
            <span className="block text-barber-charcoal">
              Book Your
            </span>
            <span className="block bg-gradient-to-r from-barber-gold via-barber-gold-dark to-barber-gold bg-clip-text text-transparent animate-gradient bg-300%">
              Perfect Cut
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed font-light">
            Premium barbers, instant booking, authentic reviews.
            <br className="hidden md:block" />
            Your next great cut is just a click away.
          </p>

          {/* CTA Buttons with Depth */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            {!isAuthenticated ? (
              <>
                <Link
                  href="/auth/register"
                  className="group relative inline-flex items-center justify-center gap-2 bg-barber-charcoal text-white px-8 py-4 rounded-xl text-lg font-medium overflow-hidden transition-all hover:scale-105 shadow-lg hover:shadow-2xl"
                >
                  <span className="relative z-10">Get Started</span>
                  <ArrowRight className="relative z-10 w-5 h-5 transition-transform group-hover:translate-x-1" />
                  <div className="absolute inset-0 bg-gradient-to-r from-barber-charcoal to-barber-charcoal-dark opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                <Link
                  href="/barbers"
                  className="group inline-flex items-center justify-center gap-2 bg-white text-barber-charcoal border-2 border-barber-charcoal/10 px-8 py-4 rounded-xl text-lg font-medium transition-all hover:border-barber-gold/30 hover:shadow-lg backdrop-blur-sm"
                >
                  Browse Barbers
                  <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/barbers"
                  className="group relative inline-flex items-center justify-center gap-2 bg-barber-charcoal text-white px-8 py-4 rounded-xl text-lg font-medium overflow-hidden transition-all hover:scale-105 shadow-lg hover:shadow-2xl"
                >
                  <span className="relative z-10">Find a Barber</span>
                  <MapPin className="relative z-10 w-5 h-5" />
                  <div className="absolute inset-0 bg-gradient-to-r from-barber-charcoal to-barber-charcoal-dark opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                <Link
                  href="/bookings"
                  className="group inline-flex items-center justify-center gap-2 bg-white text-barber-charcoal border-2 border-barber-charcoal/10 px-8 py-4 rounded-xl text-lg font-medium transition-all hover:border-barber-gold/30 hover:shadow-lg"
                >
                  My Bookings
                  <Calendar className="w-5 h-5" />
                </Link>
              </>
            )}
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-barber-gold" />
              <span>Verified Professionals</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-barber-gold" />
              <span>Instant Confirmation</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-barber-gold" />
              <span>4.9/5 Average Rating</span>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-barber-charcoal/20 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-barber-charcoal/40 rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section - Modern Cards */}
      <section className="py-24 bg-gradient-to-b from-white to-barber-cream/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-barber-charcoal mb-4">
              Why Barber Beacon?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We've reimagined the booking experience for the modern gentleman
            </p>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Large Feature Card */}
            <div className="md:col-span-2 lg:col-span-1 group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm hover:shadow-xl transition-all duration-500 border border-barber-charcoal/5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-barber-gold/10 to-transparent rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-barber-gold/10 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                  <MapPin className="w-7 h-7 text-barber-gold" />
                </div>
                <h3 className="text-2xl font-bold text-barber-charcoal mb-3">
                  Smart Location Search
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  AI-powered matching finds the perfect barber based on your location, style preferences, and reviews.
                </p>
              </div>
            </div>

            {/* Medium Feature Cards */}
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-barber-charcoal to-barber-charcoal-dark p-8 shadow-sm hover:shadow-xl transition-all duration-500">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Real-Time Booking
                </h3>
                <p className="text-white/80 leading-relaxed">
                  See live availability and book instantly. No calls, no waiting, just confirmation.
                </p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm hover:shadow-xl transition-all duration-500 border border-barber-charcoal/5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-barber-red/10 to-transparent rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150" />
              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-barber-red/10 rounded-xl mb-4 group-hover:scale-110 transition-transform">
                  <Star className="w-7 h-7 text-barber-red" />
                </div>
                <h3 className="text-2xl font-bold text-barber-charcoal mb-3">
                  Verified Reviews
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Real reviews from real clients. Photos, ratings, and detailed feedback you can trust.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Clean and Animated */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center group">
              <div className="text-6xl font-bold bg-gradient-to-r from-barber-gold to-barber-gold-dark bg-clip-text text-transparent mb-2 transition-transform group-hover:scale-110">
                500+
              </div>
              <div className="text-lg text-muted-foreground font-medium">Master Barbers</div>
              <div className="w-16 h-1 bg-barber-gold/20 mx-auto mt-4 group-hover:w-24 transition-all" />
            </div>
            <div className="text-center group">
              <div className="text-6xl font-bold text-barber-charcoal mb-2 transition-transform group-hover:scale-110">
                50K+
              </div>
              <div className="text-lg text-muted-foreground font-medium">Appointments Booked</div>
              <div className="w-16 h-1 bg-barber-charcoal/20 mx-auto mt-4 group-hover:w-24 transition-all" />
            </div>
            <div className="text-center group">
              <div className="text-6xl font-bold bg-gradient-to-r from-barber-red to-barber-red-dark bg-clip-text text-transparent mb-2 transition-transform group-hover:scale-110">
                4.9★
              </div>
              <div className="text-lg text-muted-foreground font-medium">Average Rating</div>
              <div className="w-16 h-1 bg-barber-red/20 mx-auto mt-4 group-hover:w-24 transition-all" />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-gradient-to-b from-barber-cream/20 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-barber-charcoal mb-4">
              What Our Clients Say
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join thousands of satisfied customers who've found their perfect barber
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Marcus Johnson",
                role: "Regular Client",
                content: "Finally, a booking system that actually works. Found my go-to barber in minutes.",
                rating: 5
              },
              {
                name: "David Chen",
                role: "Business Professional",
                content: "The convenience is unmatched. I book my cuts between meetings, get reminders, and never wait.",
                rating: 5
              },
              {
                name: "Alex Rivera",
                role: "First-Time User",
                content: "Was skeptical at first, but the reviews were spot-on. Great cut, great experience.",
                rating: 5
              }
            ].map((testimonial, i) => (
              <div key={i} className="group">
                <div className="relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all border border-barber-charcoal/5">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-barber-gold text-barber-gold" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6 italic">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-barber-gold/20 to-barber-gold/10 rounded-full" />
                    <div>
                      <div className="font-semibold text-barber-charcoal">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Clean and Inviting */}
      <section className="py-24 bg-gradient-to-r from-barber-charcoal to-barber-charcoal-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Look Your Best?
          </h2>
          <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Join the thousands who've discovered a better way to book their barber.
            Your perfect cut is waiting.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!isAuthenticated ? (
              <>
                <Link
                  href="/auth/register"
                  className="group inline-flex items-center justify-center gap-2 bg-barber-gold text-barber-charcoal px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:bg-barber-gold-light hover:scale-105 shadow-xl"
                >
                  Start Free Today
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/barbers"
                  className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm text-white border-2 border-white/20 px-8 py-4 rounded-xl text-lg font-medium transition-all hover:bg-white/20"
                >
                  Explore Barbers
                </Link>
              </>
            ) : (
              <Link
                href="/barbers"
                className="group inline-flex items-center justify-center gap-2 bg-barber-gold text-barber-charcoal px-8 py-4 rounded-xl text-lg font-semibold transition-all hover:bg-barber-gold-light hover:scale-105 shadow-xl"
              >
                Book Now
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        .bg-300\% {
          background-size: 300%;
        }
      `}</style>
    </div>
  )
}