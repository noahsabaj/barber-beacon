export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export function validateBookingData(data: {
  customerId: string
  barberId: string
  serviceId: string
  dateTime: string
}): ValidationResult {
  const errors: string[] = []

  if (!data.customerId || typeof data.customerId !== 'string') {
    errors.push('Valid customer ID is required')
  }

  if (!data.barberId || typeof data.barberId !== 'string') {
    errors.push('Valid barber ID is required')
  }

  if (!data.serviceId || typeof data.serviceId !== 'string') {
    errors.push('Valid service ID is required')
  }

  if (!data.dateTime) {
    errors.push('Date and time is required')
  } else {
    const bookingDate = new Date(data.dateTime)
    if (isNaN(bookingDate.getTime())) {
      errors.push('Invalid date and time format')
    } else if (bookingDate < new Date()) {
      errors.push('Booking date must be in the future')
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateServiceData(data: {
  name: string
  price: number
  duration: number
  category: string
}): ValidationResult {
  const errors: string[] = []
  const validCategories = ['cut', 'beard', 'color', 'shave', 'styling']

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Service name must be at least 2 characters')
  }

  if (!data.price || data.price <= 0) {
    errors.push('Price must be greater than 0')
  }

  if (!data.duration || data.duration <= 0) {
    errors.push('Duration must be greater than 0 minutes')
  }

  if (!data.category || !validCategories.includes(data.category)) {
    errors.push(`Category must be one of: ${validCategories.join(', ')}`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export function validateReviewData(data: {
  rating: number
  comment?: string
}): ValidationResult {
  const errors: string[] = []

  if (!data.rating || !Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
    errors.push('Rating must be an integer between 1 and 5')
  }

  if (data.comment && data.comment.length > 1000) {
    errors.push('Comment must be less than 1000 characters')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}