// Single source of truth for all validation constants
export const VALIDATION_RULES = {
  PASSWORD: {
    MIN_LENGTH: 8,
    REGEX: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/,
    REQUIREMENTS: [
      'At least 8 characters long',
      'Contains at least one letter',
      'Contains at least one number',
      'May include special characters (@$!%*#?&)'
    ],
    ERROR_MESSAGE: 'Password must be at least 8 characters with letters and numbers',
    PLACEHOLDER: 'Minimum 8 characters, letters & numbers'
  },
  EMAIL: {
    REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    ERROR_MESSAGE: 'Invalid email format'
  },
  PHONE: {
    REGEX: /^\+?1?[2-9]\d{2}[2-9]\d{2}\d{4}$/,
    ERROR_MESSAGE: 'Please enter a valid US phone number'
  },
  NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    ERROR_MESSAGE: 'Name is required'
  }
} as const

// Helper functions for validation
export const validatePassword = (password: string): boolean => {
  return VALIDATION_RULES.PASSWORD.REGEX.test(password)
}

export const validateEmail = (email: string): boolean => {
  return VALIDATION_RULES.EMAIL.REGEX.test(email)
}

export const validatePhoneNumber = (phone: string): boolean => {
  return VALIDATION_RULES.PHONE.REGEX.test(phone.replace(/\D/g, ''))
}

export const getPasswordRequirementsText = (): string => {
  return VALIDATION_RULES.PASSWORD.REQUIREMENTS.join(', ')
}

export const getPasswordPlaceholder = (): string => {
  return VALIDATION_RULES.PASSWORD.PLACEHOLDER
}