import { getDistance, isValidCoordinate } from 'geolib'

export interface GeocodingResult {
  lat: number
  lng: number
  address: string
  boundingBox?: {
    north: number
    south: number
    east: number
    west: number
  }
}

export interface DistanceOptions {
  unit?: 'miles' | 'kilometers' | 'meters'
  accuracy?: number
}

export interface Coordinates {
  lat: number
  lng: number
}

// Cache for geocoding results to reduce API calls
const geocodingCache = new Map<string, { result: GeocodingResult | null; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// Rate limiting for Nominatim API (max 1 request per second)
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL = 1000 // 1 second

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Nominatim API headers for compliance
const NOMINATIM_HEADERS = {
  'User-Agent': 'BarberBeacon/1.0 (https://barber-beacon.com)',
  'Accept': 'application/json',
  'Accept-Language': 'en'
}

export function validateCoordinates(lat: number, lng: number): boolean {
  return isValidCoordinate({ latitude: lat, longitude: lng })
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!address || address.trim().length === 0) {
    throw new Error('Address cannot be empty')
  }

  const cacheKey = address.toLowerCase().trim()
  const cached = geocodingCache.get(cacheKey)

  // Return cached result if still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.result
  }

  try {
    // Rate limiting: ensure we don't exceed 1 request per second
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await wait(MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    }
    lastRequestTime = Date.now()

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=1`,
      { headers: NOMINATIM_HEADERS }
    )

    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    let result: GeocodingResult | null = null

    if (data && data.length > 0) {
      const apiResult = data[0]
      const lat = parseFloat(apiResult.lat)
      const lng = parseFloat(apiResult.lon)

      if (!validateCoordinates(lat, lng)) {
        throw new Error('Invalid coordinates returned from geocoding API')
      }

      const resultBase = {
        lat,
        lng,
        address: apiResult.display_name
      };

      if (apiResult.boundingbox) {
        result = {
          ...resultBase,
          boundingBox: {
            south: parseFloat(apiResult.boundingbox[0]),
            north: parseFloat(apiResult.boundingbox[1]),
            west: parseFloat(apiResult.boundingbox[2]),
            east: parseFloat(apiResult.boundingbox[3])
          }
        };
      } else {
        result = resultBase
      }
    }

    // Cache the result
    geocodingCache.set(cacheKey, { result, timestamp: Date.now() })
    return result

  } catch (error) {
    console.error('Geocoding error:', error)
    // Cache null result for failed requests to avoid immediate retries
    geocodingCache.set(cacheKey, { result: null, timestamp: Date.now() })
    return null
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!validateCoordinates(lat, lng)) {
    throw new Error('Invalid coordinates provided')
  }

  const cacheKey = `${lat},${lng}`
  const cached = geocodingCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.result?.address || null
  }

  try {
    // Rate limiting
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await wait(MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    }
    lastRequestTime = Date.now()

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: NOMINATIM_HEADERS }
    )

    if (!response.ok) {
      throw new Error(`Reverse geocoding API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const address = data?.display_name || null

    // Cache the result
    const result = address ? { lat, lng, address } : null
    geocodingCache.set(cacheKey, { result, timestamp: Date.now() })

    return address

  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return null
  }
}

export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates,
  options: DistanceOptions = {}
): number {
  const { unit = 'miles', accuracy = 1 } = options

  if (!validateCoordinates(point1.lat, point1.lng)) {
    throw new Error('Invalid coordinates for point1')
  }

  if (!validateCoordinates(point2.lat, point2.lng)) {
    throw new Error('Invalid coordinates for point2')
  }

  // Use geolib for accurate distance calculation
  const distanceInMeters = getDistance(
    { latitude: point1.lat, longitude: point1.lng },
    { latitude: point2.lat, longitude: point2.lng },
    accuracy
  )

  // Convert to requested unit
  switch (unit) {
    case 'meters':
      return distanceInMeters
    case 'kilometers':
      return distanceInMeters / 1000
    case 'miles':
      return distanceInMeters / 1609.344
    default:
      throw new Error('Invalid unit. Use "miles", "kilometers", or "meters"')
  }
}

// Backward compatibility function
export function calculateDistanceLegacy(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return calculateDistance({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }, { unit: 'miles' })
}

// Utility function to clear cache (useful for testing)
export function clearGeocodingCache(): void {
  geocodingCache.clear()
}

// Utility function to get cache stats (useful for monitoring)
export function getGeocodingCacheStats(): { size: number; entries: number } {
  return {
    size: geocodingCache.size,
    entries: geocodingCache.size
  }
}