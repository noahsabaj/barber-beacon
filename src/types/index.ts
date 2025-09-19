export interface User {
  id: string
  email: string
  role: 'customer' | 'barber' | 'admin'
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
  createdAt: string
  barberProfile?: BarberProfile
}

export interface BarberProfile {
  id: string
  userId: string
  businessName: string
  bio?: string
  location: {
    lat: number
    lng: number
  }
  hourlyRate?: number
  portfolio: string[]
  workingHours: {
    [key: string]: {
      start: string
      end: string
    }
  }
  services: Service[]
  averageRating?: number
  reviewCount?: number
  distance?: number
}

export interface Service {
  id: string
  barberId: string
  name: string
  description?: string
  price: number
  duration: number
  category: 'cut' | 'beard' | 'color' | 'shave' | 'styling'
}

export interface Booking {
  id: string
  customerId: string
  barberId: string
  serviceId: string
  dateTime: string
  status: 'scheduled' | 'completed' | 'canceled'
  paymentStatus: 'pending' | 'paid' | 'failed'
  totalAmount: number
  createdAt: string
  customer?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  barber?: {
    businessName: string
    user?: {
      firstName?: string
      lastName?: string
      phone?: string
    }
  }
  service?: Service
  payment?: Payment
  review?: Review
}

export interface Review {
  id: string
  customerId: string
  barberId: string
  bookingId: string
  rating: number
  comment?: string
  createdAt: string
  customer?: {
    firstName?: string
    lastName?: string
  }
  barber?: {
    businessName: string
  }
  booking?: {
    dateTime: string
    service?: {
      name: string
      category: string
    }
  }
}

export interface Payment {
  id: string
  bookingId: string
  amount: number
  stripePaymentId: string
  status: 'succeeded' | 'failed' | 'pending'
  createdAt: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  errors?: string[]
}

export interface SearchCriteria {
  location: {
    lat: number
    lng: number
  }
  radius: number
  service?: string
  priceRange: {
    min: number
    max: number
  }
}

export interface BarberSearchResults {
  barbers: BarberProfile[]
  total: number
  searchCriteria: SearchCriteria
}