import bcryptjs from 'bcryptjs'
import { validateEmail, validatePassword, validatePhoneNumber } from './validation-constants'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcryptjs.compare(password, hashedPassword)
}

// Re-export validation functions from single source of truth
export { validateEmail, validatePassword, validatePhoneNumber }