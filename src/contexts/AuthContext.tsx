'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, AuthState } from '@/types'

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>
  loginWithToken: (user: User, token: string) => void
  register: (userData: RegisterData) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
}

interface RegisterData {
  email: string
  password: string
  role?: string
  firstName?: string
  lastName?: string
  phone?: string
  address?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false
  })

  useEffect(() => {
    // Check for existing token on app load
    const token = localStorage.getItem('barber_beacon_token')
    if (token) {
      verifyToken(token)
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [])

  const verifyToken = async (token: string) => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        // Handle successful response - check for both direct fields and data wrapper
        const userData = data.data?.user || data.user || data

        setAuthState({
          user: userData,
          token,
          isLoading: false,
          isAuthenticated: true
        })
      } else {
        localStorage.removeItem('barber_beacon_token')
        setAuthState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false
        })
      }
    } catch (error) {
      console.error('Token verification failed:', error)
      localStorage.removeItem('barber_beacon_token')
      setAuthState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false
      })
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        // Handle successful response - check for both direct fields and data wrapper
        const userData = data.data?.user || data.user
        const token = data.data?.accessToken || data.accessToken || data.token

        if (!userData || !token) {
          throw new Error('Invalid response from server')
        }

        localStorage.setItem('barber_beacon_token', token)
        setAuthState({
          user: userData,
          token: token,
          isLoading: false,
          isAuthenticated: true
        })
      } else {
        // Handle API error response format
        const errorMessage = data.error?.message || data.error || data.message || 'Login failed'
        throw new Error(typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage)
      }
    } catch (error) {
      throw error
    }
  }

  const register = async (userData: RegisterData) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      const data = await response.json()

      if (response.ok) {
        // After successful registration, log the user in
        await login(userData.email, userData.password)
      } else {
        // Handle API error response format
        const errorMessage = data.error?.message || data.error || data.message || 'Registration failed'
        throw new Error(typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage)
      }
    } catch (error) {
      throw error
    }
  }

  const logout = () => {
    localStorage.removeItem('barber_beacon_token')
    setAuthState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false
    })
  }

  const loginWithToken = (user: User, token: string) => {
    localStorage.setItem('barber_beacon_token', token)
    setAuthState({
      user,
      token,
      isLoading: false,
      isAuthenticated: true
    })
  }

  const updateUser = (user: User) => {
    setAuthState(prev => ({
      ...prev,
      user
    }))
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        loginWithToken,
        register,
        logout,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}