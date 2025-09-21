/**
 * Enhanced Rate Limiting Middleware
 *
 * Enterprise-grade rate limiting system with multiple strategies,
 * Redis support, and comprehensive monitoring capabilities.
 *
 * Features:
 * - Multiple rate limiting algorithms (Fixed Window, Sliding Window, Token Bucket)
 * - Redis support for distributed systems with in-memory fallback
 * - Per-user, per-IP, and per-endpoint rate limiting
 * - Custom rate limit rules and bypass lists
 * - Detailed rate limit headers and analytics
 * - Integration with error handling system
 * - Configurable time windows and limits
 * - Rate limit warmup and burst handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { RateLimitError } from '../base/ApiError'
import { ResponseHelpers, type ResponseOptions } from '../utils/responseUtils'

export type RateLimitStrategy = 'fixed-window' | 'sliding-window' | 'token-bucket'

export interface RateLimitConfig {
  strategy?: RateLimitStrategy
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string
  skip?: (request: NextRequest) => boolean | Promise<boolean>
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  enableHeaderInfo?: boolean
  customHeaders?: Record<string, string>
  onLimitReached?: (request: NextRequest, rateLimitInfo: RateLimitInfo) => void
  store?: RateLimitStore
}

export interface RateLimitInfo {
  totalRequests: number
  remainingRequests: number
  resetTime: Date
  retryAfter: number
  isLimited: boolean
  strategy: RateLimitStrategy
  windowMs: number
  maxRequests: number
}

export interface RateLimitStore {
  get(key: string): Promise<RateLimitData | null>
  set(key: string, data: RateLimitData, ttl: number): Promise<void>
  increment(key: string, ttl: number): Promise<RateLimitData>
  reset(key: string): Promise<void>
  cleanup(): Promise<void>
}

export interface RateLimitData {
  count: number
  resetTime: number
  firstRequest?: number
  tokens?: number
  lastRefill?: number
}

/**
 * Enhanced Rate Limit Middleware Factory
 */
export function withRateLimit(config: RateLimitConfig) {
  const rateLimiter = new RateLimiter(config)

  return function <T = any>(
    handler: (request: NextRequest, context?: any) => Promise<T>
  ) {
    return async (request: NextRequest, context?: any): Promise<NextResponse> => {
      const requestId = `rl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const responseOptions: ResponseOptions = { requestId }

      try {
        // Check if request should be skipped
        if (config.skip && await config.skip(request)) {
          const result = await handler(request, context)
          if (result instanceof NextResponse) {
            result.headers.set('X-Request-ID', requestId)
            return result
          }
          return ResponseHelpers.success(result, responseOptions)
        }

        // Check rate limit
        const rateLimitInfo = await rateLimiter.checkLimit(request)

        if (rateLimitInfo.isLimited) {
          // Call custom handler if provided
          if (config.onLimitReached) {
            config.onLimitReached(request, rateLimitInfo)
          }

          // Create rate limit error response
          const error = new RateLimitError(
            `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs}ms`,
            { metadata: { retryAfter: rateLimitInfo.retryAfter } }
          );
          const response = NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.statusCode }
          )

          // Add rate limit headers
          addRateLimitHeaders(response, rateLimitInfo, config.enableHeaderInfo)
          return response
        }

        // Execute handler
        const result = await handler(request, context)

        // Create response
        let response: NextResponse
        if (result instanceof NextResponse) {
          response = result
        } else {
          response = ResponseHelpers.success(result, responseOptions)
        }

        // Add rate limit headers to successful responses
        if (config.enableHeaderInfo !== false) {
          addRateLimitHeaders(response, rateLimitInfo, true)
        }

        return response
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Internal server error' },
          { status: 500 }
        )
      }
    }
  }
}

/**
 * Main Rate Limiter Class
 */
export class RateLimiter {
  private config: Required<RateLimitConfig>
  private store: RateLimitStore

  constructor(config: RateLimitConfig) {
    this.config = {
      strategy: 'fixed-window',
      keyGenerator: this.defaultKeyGenerator,
      skip: () => false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      enableHeaderInfo: true,
      customHeaders: {},
      onLimitReached: () => {},
      store: new InMemoryRateLimitStore(),
      ...config
    }

    this.store = this.config.store
  }

  async checkLimit(request: NextRequest): Promise<RateLimitInfo> {
    const key = this.config.keyGenerator(request)
    const now = Date.now()

    switch (this.config.strategy) {
      case 'fixed-window':
        return this.checkFixedWindow(key, now)
      case 'sliding-window':
        return this.checkSlidingWindow(key, now)
      case 'token-bucket':
        return this.checkTokenBucket(key, now)
      default:
        throw new Error(`Unsupported rate limit strategy: ${this.config.strategy}`)
    }
  }

  private async checkFixedWindow(key: string, now: number): Promise<RateLimitInfo> {
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs
    const windowKey = `${key}:${windowStart}`

    const data = await this.store.get(windowKey)
    const count = data ? data.count : 0
    const resetTime = new Date(windowStart + this.config.windowMs)

    if (count >= this.config.maxRequests) {
      return {
        totalRequests: count,
        remainingRequests: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime.getTime() - now) / 1000),
        isLimited: true,
        strategy: 'fixed-window',
        windowMs: this.config.windowMs,
        maxRequests: this.config.maxRequests
      }
    }

    // Increment counter
    await this.store.increment(windowKey, this.config.windowMs)

    return {
      totalRequests: count + 1,
      remainingRequests: this.config.maxRequests - count - 1,
      resetTime,
      retryAfter: 0,
      isLimited: false,
      strategy: 'fixed-window',
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests
    }
  }

  private async checkSlidingWindow(key: string, now: number): Promise<RateLimitInfo> {
    const data = await this.store.get(key)
    const windowStart = now - this.config.windowMs

    // Count requests within sliding window
    let count = 0
    if (data && data.firstRequest && data.firstRequest > windowStart) {
      count = data.count
    }

    if (count >= this.config.maxRequests) {
      const oldestRequestTime = data?.firstRequest || now
      const resetTime = new Date(oldestRequestTime + this.config.windowMs)

      return {
        totalRequests: count,
        remainingRequests: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime.getTime() - now) / 1000),
        isLimited: true,
        strategy: 'sliding-window',
        windowMs: this.config.windowMs,
        maxRequests: this.config.maxRequests
      }
    }

    // Update sliding window data
    const newData: RateLimitData = {
      count: count + 1,
      resetTime: now + this.config.windowMs,
      firstRequest: data?.firstRequest || now
    }

    await this.store.set(key, newData, this.config.windowMs)

    return {
      totalRequests: count + 1,
      remainingRequests: this.config.maxRequests - count - 1,
      resetTime: new Date(now + this.config.windowMs),
      retryAfter: 0,
      isLimited: false,
      strategy: 'sliding-window',
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests
    }
  }

  private async checkTokenBucket(key: string, now: number): Promise<RateLimitInfo> {
    const data = await this.store.get(key)
    const refillRate = this.config.maxRequests / (this.config.windowMs / 1000) // tokens per second
    const bucketSize = this.config.maxRequests

    let tokens = data?.tokens || bucketSize
    const lastRefill = data?.lastRefill || now

    // Refill tokens based on time elapsed
    const timeElapsed = (now - lastRefill) / 1000
    const tokensToAdd = Math.floor(timeElapsed * refillRate)
    tokens = Math.min(bucketSize, tokens + tokensToAdd)

    if (tokens < 1) {
      const refillTime = Math.ceil((1 - tokens) / refillRate)
      return {
        totalRequests: bucketSize - Math.floor(tokens),
        remainingRequests: 0,
        resetTime: new Date(now + refillTime * 1000),
        retryAfter: refillTime,
        isLimited: true,
        strategy: 'token-bucket',
        windowMs: this.config.windowMs,
        maxRequests: this.config.maxRequests
      }
    }

    // Consume one token
    tokens -= 1

    const newData: RateLimitData = {
      count: bucketSize - Math.floor(tokens),
      resetTime: now + this.config.windowMs,
      tokens,
      lastRefill: now
    }

    await this.store.set(key, newData, this.config.windowMs * 2) // Longer TTL for token bucket

    return {
      totalRequests: bucketSize - Math.floor(tokens),
      remainingRequests: Math.floor(tokens),
      resetTime: new Date(now + (Math.floor(tokens) / refillRate) * 1000),
      retryAfter: 0,
      isLimited: false,
      strategy: 'token-bucket',
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests
    }
  }

  private defaultKeyGenerator(request: NextRequest): string {
    const ip = getClientIP(request)
    const path = new URL(request.url).pathname
    return `ratelimit:${ip}:${path}`
  }
}

/**
 * In-Memory Rate Limit Store
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private data = new Map<string, { data: RateLimitData; expiry: number }>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  async get(key: string): Promise<RateLimitData | null> {
    const entry = this.data.get(key)
    if (!entry || entry.expiry < Date.now()) {
      this.data.delete(key)
      return null
    }
    return entry.data
  }

  async set(key: string, data: RateLimitData, ttl: number): Promise<void> {
    this.data.set(key, {
      data,
      expiry: Date.now() + ttl
    })
  }

  async increment(key: string, ttl: number): Promise<RateLimitData> {
    const existing = await this.get(key)
    const data: RateLimitData = {
      count: (existing?.count || 0) + 1,
      resetTime: existing?.resetTime || Date.now() + ttl,
      firstRequest: existing?.firstRequest || Date.now()
    }

    await this.set(key, data, ttl)
    return data
  }

  async reset(key: string): Promise<void> {
    this.data.delete(key)
  }

  async cleanup(): Promise<void> {
    const now = Date.now()
    for (const [key, entry] of this.data.entries()) {
      if (entry.expiry < now) {
        this.data.delete(key)
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.data.clear()
  }
}

/**
 * Redis Rate Limit Store
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redis: any // Redis client instance
  private fallback: InMemoryRateLimitStore

  constructor(redisClient?: any) {
    this.redis = redisClient
    this.fallback = new InMemoryRateLimitStore()
  }

  async get(key: string): Promise<RateLimitData | null> {
    try {
      if (!this.redis) {
        return this.fallback.get(key)
      }

      const data = await this.redis.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.warn('Redis rate limit get failed, using fallback:', error)
      return this.fallback.get(key)
    }
  }

  async set(key: string, data: RateLimitData, ttl: number): Promise<void> {
    try {
      if (!this.redis) {
        return this.fallback.set(key, data, ttl)
      }

      await this.redis.setex(key, Math.ceil(ttl / 1000), JSON.stringify(data))
    } catch (error) {
      console.warn('Redis rate limit set failed, using fallback:', error)
      return this.fallback.set(key, data, ttl)
    }
  }

  async increment(key: string, ttl: number): Promise<RateLimitData> {
    try {
      if (!this.redis) {
        return this.fallback.increment(key, ttl)
      }

      const pipeline = this.redis.pipeline()
      pipeline.multi()
      pipeline.incr(key)
      pipeline.expire(key, Math.ceil(ttl / 1000))
      pipeline.exec()

      const results = await pipeline.exec()
      const count = results[1][1] // Get result from incr command

      return {
        count,
        resetTime: Date.now() + ttl,
        firstRequest: Date.now()
      }
    } catch (error) {
      console.warn('Redis rate limit increment failed, using fallback:', error)
      return this.fallback.increment(key, ttl)
    }
  }

  async reset(key: string): Promise<void> {
    try {
      if (!this.redis) {
        return this.fallback.reset(key)
      }

      await this.redis.del(key)
    } catch (error) {
      console.warn('Redis rate limit reset failed, using fallback:', error)
      return this.fallback.reset(key)
    }
  }

  async cleanup(): Promise<void> {
    // Redis handles TTL automatically, but clean up fallback
    return this.fallback.cleanup()
  }
}

/**
 * Pre-configured Rate Limit Configurations
 */
export const RateLimitConfigs = {
  // Very strict - for authentication endpoints
  authentication: {
    strategy: 'fixed-window' as RateLimitStrategy,
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyGenerator: (request: NextRequest) => {
      const ip = getClientIP(request)
      return `auth:${ip}`
    }
  },

  // Moderate - for general API usage
  general: {
    strategy: 'sliding-window' as RateLimitStrategy,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyGenerator: (request: NextRequest) => {
      const ip = getClientIP(request)
      return `general:${ip}`
    }
  },

  // Lenient - for search and read operations
  search: {
    strategy: 'token-bucket' as RateLimitStrategy,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    keyGenerator: (request: NextRequest) => {
      const ip = getClientIP(request)
      return `search:${ip}`
    }
  },

  // Per-user limits for authenticated requests
  perUser: {
    strategy: 'sliding-window' as RateLimitStrategy,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    keyGenerator: (request: NextRequest) => {
      const userId = getUserIdFromToken(request)
      return userId ? `user:${userId}` : `ip:${getClientIP(request)}`
    }
  },

  // Booking operations - more restrictive
  booking: {
    strategy: 'fixed-window' as RateLimitStrategy,
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    keyGenerator: (request: NextRequest) => {
      const userId = getUserIdFromToken(request)
      return userId ? `booking:${userId}` : `booking:${getClientIP(request)}`
    }
  }
}

/**
 * Rate Limit Middleware Factories
 */
export const RateLimitMiddleware = {
  // Authentication endpoints
  auth() {
    return withRateLimit(RateLimitConfigs.authentication)
  },

  // General API endpoints
  general() {
    return withRateLimit(RateLimitConfigs.general)
  },

  // Search endpoints
  search() {
    return withRateLimit(RateLimitConfigs.search)
  },

  // Per-user limits
  perUser() {
    return withRateLimit(RateLimitConfigs.perUser)
  },

  // Booking endpoints
  booking() {
    return withRateLimit(RateLimitConfigs.booking)
  },

  // Custom rate limit
  custom(config: RateLimitConfig) {
    return withRateLimit(config)
  },

  // Multiple rate limits (apply multiple limits to same endpoint)
  multiple(configs: RateLimitConfig[]) {
    return function <T = any>(
      handler: (request: NextRequest, context?: any) => Promise<T>
    ) {
      // Apply rate limits in sequence
      let wrappedHandler = handler

      for (let i = configs.length - 1; i >= 0; i--) {
        const config = configs[i]
        if (config) {
          wrappedHandler = withRateLimit(config)(wrappedHandler) as any
        }
      }

      return wrappedHandler
    }
  }
}

/**
 * Utility Functions
 */
function addRateLimitHeaders(
  response: NextResponse,
  rateLimitInfo: RateLimitInfo,
  enableHeaderInfo: boolean = true
): void {
  if (!enableHeaderInfo) return

  response.headers.set('X-RateLimit-Limit', rateLimitInfo.maxRequests.toString())
  response.headers.set('X-RateLimit-Remaining', rateLimitInfo.remainingRequests.toString())
  response.headers.set('X-RateLimit-Reset', rateLimitInfo.resetTime.toISOString())
  response.headers.set('X-RateLimit-Strategy', rateLimitInfo.strategy)

  if (rateLimitInfo.isLimited) {
    response.headers.set('Retry-After', rateLimitInfo.retryAfter.toString())
  }
}

function getClientIP(request: NextRequest): string {
  // Check various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cloudflareIP = request.headers.get('cf-connecting-ip')

  if (cloudflareIP) return cloudflareIP
  if (realIP) return realIP
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'

  return 'unknown'
}

function getUserIdFromToken(request: NextRequest): string | null {
  // Extract user ID from JWT token
  // This would integrate with your auth middleware
  const authorization = request.headers.get('authorization')
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null
  }

  // TODO: Implement JWT token parsing to extract user ID
  // For now, return null to fall back to IP-based limiting
  return null
}

/**
 * Rate Limit Analytics
 */
export class RateLimitAnalytics {
  private events: Array<{
    timestamp: number
    key: string
    ip: string
    path: string
    isLimited: boolean
    strategy: RateLimitStrategy
    requests: number
  }> = []

  logRateLimit(
    request: NextRequest,
    rateLimitInfo: RateLimitInfo,
    key: string
  ): void {
    this.events.push({
      timestamp: Date.now(),
      key,
      ip: getClientIP(request),
      path: new URL(request.url).pathname,
      isLimited: rateLimitInfo.isLimited,
      strategy: rateLimitInfo.strategy,
      requests: rateLimitInfo.totalRequests
    })

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000)
    }
  }

  getAnalytics(timeframe: number = 60 * 60 * 1000): any {
    const since = Date.now() - timeframe
    const recentEvents = this.events.filter(event => event.timestamp > since)

    return {
      totalRequests: recentEvents.length,
      limitedRequests: recentEvents.filter(e => e.isLimited).length,
      topIPs: this.getTopEntries(recentEvents, 'ip'),
      topPaths: this.getTopEntries(recentEvents, 'path'),
      strategyBreakdown: this.getStrategyBreakdown(recentEvents)
    }
  }

  private getTopEntries(events: any[], field: string): any[] {
    const counts = events.reduce((acc, event) => {
      acc[event[field]] = (acc[event[field]] || 0) + 1
      return acc
    }, {})

    return Object.entries(counts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([key, count]) => ({ [field]: key, count }))
  }

  private getStrategyBreakdown(events: any[]): any {
    return events.reduce((acc, event) => {
      acc[event.strategy] = (acc[event.strategy] || 0) + 1
      return acc
    }, {})
  }
}