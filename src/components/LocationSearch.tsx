'use client'

import React, { useState } from 'react'

interface LocationSearchProps {
  onLocationSelect: (lat: number, lng: number, address: string) => void
  placeholder?: string
  className?: string
}

interface SearchResult {
  lat: string
  lon: string
  display_name: string
}

export default function LocationSearch({
  onLocationSelect,
  placeholder = "Search for location...",
  className = ""
}: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const searchLocation = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
      )
      const data = await response.json()
      setResults(data)
      setShowResults(true)
    } catch (error) {
      console.error('Location search error:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)

    // Debounce search
    const timeoutId = setTimeout(() => {
      searchLocation(value)
    }, 500)

    return () => clearTimeout(timeoutId)
  }

  const handleResultSelect = (result: SearchResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    onLocationSelect(lat, lng, result.display_name)
    setQuery(result.display_name)
    setShowResults(false)
  }

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          onLocationSelect(latitude, longitude, 'Current Location')
          setQuery('Current Location')
        },
        (error) => {
          console.error('Geolocation error:', error)
          alert('Unable to get your location. Please search manually.')
        }
      )
    } else {
      alert('Geolocation is not supported by this browser.')
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex space-x-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Search Results Dropdown */}
          {showResults && results.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {results.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleResultSelect(result)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none border-b last:border-b-0"
                >
                  <div className="truncate">{result.display_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={getCurrentLocation}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none whitespace-nowrap"
          title="Use my current location"
        >
          📍 Current
        </button>
      </div>

      {showResults && results.length === 0 && query && !isLoading && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-gray-500 text-center">
          No locations found. Try a different search term.
        </div>
      )}
    </div>
  )
}