import { NextApiRequest, NextApiResponse } from 'next'
import { verifyToken, extractTokenFromHeader, JWTPayload } from './jwt'

export interface AuthenticatedRequest extends NextApiRequest {
  user: JWTPayload
}

export function withAuth(handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      const token = extractTokenFromHeader(req.headers.authorization)

      if (!token) {
        return res.status(401).json({ error: 'No token provided' })
      }

      const user = verifyToken(token)
      ;(req as AuthenticatedRequest).user = user

      return handler(req as AuthenticatedRequest, res)
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
}

export function withRoleAuth(roles: string[]) {
  return function (handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>) {
    return withAuth(async (req: AuthenticatedRequest, res: NextApiResponse) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      return handler(req, res)
    })
  }
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export function withRateLimit(requestsPerWindow: number = 100, windowMs: number = 15 * 60 * 1000) {
  return function (handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>) {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown'
      const key = Array.isArray(ip) ? ip[0] : ip
      const now = Date.now()

      let record = rateLimitStore.get(key)

      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + windowMs }
        rateLimitStore.set(key, record)
      }

      if (record.count >= requestsPerWindow) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        })
      }

      record.count++
      return handler(req, res)
    }
  }
}