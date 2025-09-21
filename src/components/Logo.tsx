import React from 'react'
import Link from 'next/link'

interface LogoProps {
  className?: string
  showText?: boolean
  linkToHome?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function Logo({
  className = '',
  showText = true,
  linkToHome = true,
  size = 'md'
}: LogoProps) {
  const sizes = {
    sm: { icon: 'w-8 h-8', text: 'text-xl' },
    md: { icon: 'w-10 h-10', text: 'text-2xl' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl' }
  }

  const LogoContent = (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Barber Pole & Scissors Icon */}
      <div className={`${sizes[size].icon} relative`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Barber Pole Background */}
          <rect x="4" y="8" width="8" height="32" rx="1" className="fill-barber-charcoal" />

          {/* Barber Pole Stripes */}
          <path
            d="M 5 12 L 11 8 L 11 16 L 5 20 Z"
            className="fill-barber-red"
          />
          <path
            d="M 5 20 L 11 16 L 11 24 L 5 28 Z"
            className="fill-white"
          />
          <path
            d="M 5 28 L 11 24 L 11 32 L 5 36 Z"
            className="fill-barber-red"
          />
          <path
            d="M 5 36 L 11 32 L 11 40 L 5 40 Z"
            className="fill-white"
          />

          {/* Scissors */}
          <g transform="translate(16, 12)">
            {/* Scissors Blades */}
            <path
              d="M 8 4 L 20 16 L 22 14 L 10 2 C 9 1 7 1 6 2 C 5 3 5 5 6 6 L 8 4 Z"
              className="fill-barber-gold stroke-barber-charcoal"
              strokeWidth="0.5"
            />
            <path
              d="M 8 20 L 20 8 L 22 10 L 10 22 C 9 23 7 23 6 22 C 5 21 5 19 6 18 L 8 20 Z"
              className="fill-barber-gold stroke-barber-charcoal"
              strokeWidth="0.5"
            />

            {/* Scissors Center Screw */}
            <circle
              cx="15"
              cy="12"
              r="2"
              className="fill-barber-charcoal"
            />

            {/* Scissors Handles */}
            <circle
              cx="7"
              cy="5"
              r="3"
              className="stroke-barber-charcoal fill-none"
              strokeWidth="1.5"
            />
            <circle
              cx="7"
              cy="19"
              r="3"
              className="stroke-barber-charcoal fill-none"
              strokeWidth="1.5"
            />
          </g>

          {/* Top and Bottom Caps for Pole */}
          <rect x="3" y="6" width="10" height="3" rx="0.5" className="fill-barber-gold" />
          <rect x="3" y="39" width="10" height="3" rx="0.5" className="fill-barber-gold" />
        </svg>
      </div>

      {showText && (
        <div className="flex items-baseline gap-1">
          <span className={`${sizes[size].text} font-bold text-barber-charcoal dark:text-barber-cream`}>
            Barber
          </span>
          <span className={`${sizes[size].text} font-light text-barber-gold dark:text-barber-gold`}>
            Beacon
          </span>
        </div>
      )}
    </div>
  )

  if (linkToHome) {
    return (
      <Link href="/" className="inline-flex hover:opacity-90 transition-opacity">
        {LogoContent}
      </Link>
    )
  }

  return LogoContent
}