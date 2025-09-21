'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface PasswordStrength {
  score: number;
  feedback: string[];
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSpecialChars: boolean;
}

interface EmailValidation {
  isValid: boolean;
  errors: string[];
}

interface LoginAttemptValidation {
  canAttempt: boolean;
  attemptsRemaining: number;
  isBlocked: boolean;
  timeUntilUnblock?: number;
}

// Password validation hook
export function usePasswordValidation(password: string) {
  const [strength, setStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumbers: false,
    hasSpecialChars: false,
  });

  useEffect(() => {
    const validatePassword = (pwd: string): PasswordStrength => {
      const feedback: string[] = [];
      let score = 0;

      // Check minimum length
      const hasMinLength = pwd.length >= 8;
      if (!hasMinLength) {
        feedback.push('Password must be at least 8 characters long');
      } else {
        score += 1;
      }

      // Check for uppercase letters
      const hasUppercase = /[A-Z]/.test(pwd);
      if (!hasUppercase) {
        feedback.push('Password must contain at least one uppercase letter');
      } else {
        score += 1;
      }

      // Check for lowercase letters
      const hasLowercase = /[a-z]/.test(pwd);
      if (!hasLowercase) {
        feedback.push('Password must contain at least one lowercase letter');
      } else {
        score += 1;
      }

      // Check for numbers
      const hasNumbers = /\d/.test(pwd);
      if (!hasNumbers) {
        feedback.push('Password must contain at least one number');
      } else {
        score += 1;
      }

      // Check for special characters
      const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);
      if (!hasSpecialChars) {
        feedback.push('Password must contain at least one special character');
      } else {
        score += 1;
      }

      // Additional scoring based on length and complexity
      if (pwd.length >= 12) score += 1;
      if (pwd.length >= 16) score += 1;

      // Check for common patterns (decrease score)
      const commonPatterns = [
        /123456/,
        /password/i,
        /qwerty/i,
        /abc123/i,
        /admin/i,
      ];

      commonPatterns.forEach(pattern => {
        if (pattern.test(pwd)) {
          score = Math.max(0, score - 2);
          feedback.push('Password contains common patterns');
        }
      });

      return {
        score: Math.min(score, 5),
        feedback,
        hasMinLength,
        hasUppercase,
        hasLowercase,
        hasNumbers,
        hasSpecialChars,
      };
    };

    setStrength(validatePassword(password));
  }, [password]);

  const strengthLabel = useMemo(() => {
    switch (strength.score) {
      case 0:
      case 1:
        return 'Very Weak';
      case 2:
        return 'Weak';
      case 3:
        return 'Fair';
      case 4:
        return 'Good';
      case 5:
        return 'Strong';
      default:
        return 'Unknown';
    }
  }, [strength.score]);

  const strengthColor = useMemo(() => {
    switch (strength.score) {
      case 0:
      case 1:
        return 'text-red-600';
      case 2:
        return 'text-orange-600';
      case 3:
        return 'text-yellow-600';
      case 4:
        return 'text-blue-600';
      case 5:
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  }, [strength.score]);

  const isValid = strength.score >= 3;

  return {
    strength,
    strengthLabel,
    strengthColor,
    isValid,
    isStrong: strength.score >= 4,
  };
}

// Email validation hook
export function useEmailValidation(email: string) {
  const [validation, setValidation] = useState<EmailValidation>({
    isValid: false,
    errors: [],
  });

  useEffect(() => {
    const validateEmail = (emailValue: string): EmailValidation => {
      const errors: string[] = [];

      if (!emailValue) {
        return { isValid: false, errors: ['Email is required'] };
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailValue)) {
        errors.push('Please enter a valid email address');
      }

      // Check email length
      if (emailValue.length > 254) {
        errors.push('Email address is too long');
      }

      // Check for common typos in domains
      const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
      const domain = emailValue.split('@')[1]?.toLowerCase();

      if (domain) {
        const suggestions = commonDomains.filter(d =>
          d !== domain &&
          (d.includes(domain.slice(0, -1)) || domain.includes(d.slice(0, -1)))
        );

        if (suggestions.length > 0) {
          errors.push(`Did you mean ${suggestions[0]}?`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    };

    setValidation(validateEmail(email));
  }, [email]);

  return validation;
}

// Login attempt validation hook
export function useLoginAttemptValidation() {
  const {
    loginAttempts,
    lastLoginAttempt,
    isLoginBlocked
  } = useAuthStore();

  const [timeUntilUnblock, setTimeUntilUnblock] = useState<number>(0);

  useEffect(() => {
    if (!isLoginBlocked || !lastLoginAttempt) {
      setTimeUntilUnblock(0);
      return;
    }

    const updateTimer = () => {
      const blockDuration = 15 * 60 * 1000; // 15 minutes
      const timeElapsed = Date.now() - lastLoginAttempt;
      const remaining = Math.max(0, blockDuration - timeElapsed);

      setTimeUntilUnblock(remaining);

      if (remaining === 0) {
        // Auto-unblock when time expires
        useAuthStore.getState().resetLoginAttempts();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [isLoginBlocked, lastLoginAttempt]);

  const maxAttempts = 5;
  const attemptsRemaining = Math.max(0, maxAttempts - loginAttempts);
  const canAttempt = !isLoginBlocked;

  const formatTimeUntilUnblock = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    canAttempt,
    attemptsRemaining,
    isBlocked: isLoginBlocked,
    timeUntilUnblock: timeUntilUnblock > 0 ? formatTimeUntilUnblock(timeUntilUnblock) : undefined,
    maxAttempts,
  } as unknown as LoginAttemptValidation & {
    maxAttempts: number;
    timeUntilUnblock?: string;
  };
}

// Password confirmation validation hook
export function usePasswordConfirmation(password: string, confirmPassword: string) {
  const [validation, setValidation] = useState({
    isValid: false,
    error: '',
  });

  useEffect(() => {
    if (!confirmPassword) {
      setValidation({ isValid: false, error: '' });
      return;
    }

    if (password !== confirmPassword) {
      setValidation({
        isValid: false,
        error: 'Passwords do not match'
      });
    } else {
      setValidation({ isValid: true, error: '' });
    }
  }, [password, confirmPassword]);

  return validation;
}

// Username validation hook
export function useUsernameValidation(username: string) {
  const [validation, setValidation] = useState({
    isValid: false,
    errors: [] as string[],
  });

  useEffect(() => {
    const validateUsername = (usernameValue: string) => {
      const errors: string[] = [];

      if (!usernameValue) {
        return { isValid: false, errors: ['Username is required'] };
      }

      // Length validation
      if (usernameValue.length < 3) {
        errors.push('Username must be at least 3 characters long');
      }

      if (usernameValue.length > 20) {
        errors.push('Username must be less than 20 characters long');
      }

      // Character validation
      if (!/^[a-zA-Z0-9_-]+$/.test(usernameValue)) {
        errors.push('Username can only contain letters, numbers, underscores, and hyphens');
      }

      // Must start with a letter
      if (!/^[a-zA-Z]/.test(usernameValue)) {
        errors.push('Username must start with a letter');
      }

      // Cannot end with special characters
      if (/[-_]$/.test(usernameValue)) {
        errors.push('Username cannot end with a hyphen or underscore');
      }

      // Reserved usernames
      const reservedUsernames = [
        'admin', 'administrator', 'root', 'api', 'www', 'ftp', 'mail',
        'email', 'support', 'help', 'info', 'null', 'undefined',
      ];

      if (reservedUsernames.includes(usernameValue.toLowerCase())) {
        errors.push('This username is reserved and cannot be used');
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    };

    setValidation(validateUsername(username));
  }, [username]);

  return validation;
}

// Combined registration validation hook
export function useRegistrationValidation(data: {
  email: string;
  password: string;
  confirmPassword: string;
  username?: string;
}) {
  const emailValidation = useEmailValidation(data.email);
  const passwordValidation = usePasswordValidation(data.password);
  const passwordConfirmation = usePasswordConfirmation(data.password, data.confirmPassword);
  const usernameValidation = useUsernameValidation(data.username || '');

  const isValid = useMemo(() => {
    return (
      emailValidation.isValid &&
      passwordValidation.isValid &&
      passwordConfirmation.isValid &&
      (!data.username || usernameValidation.isValid)
    );
  }, [
    emailValidation.isValid,
    passwordValidation.isValid,
    passwordConfirmation.isValid,
    usernameValidation.isValid,
    data.username,
  ]);

  const errors = useMemo(() => {
    const allErrors: string[] = [];

    allErrors.push(...emailValidation.errors);
    allErrors.push(...passwordValidation.strength.feedback);

    if (passwordConfirmation.error) {
      allErrors.push(passwordConfirmation.error);
    }

    if (data.username) {
      allErrors.push(...usernameValidation.errors);
    }

    return allErrors;
  }, [
    emailValidation.errors,
    passwordValidation.strength.feedback,
    passwordConfirmation.error,
    usernameValidation.errors,
    data.username,
  ]);

  return {
    isValid,
    errors,
    emailValidation,
    passwordValidation,
    passwordConfirmation,
    usernameValidation,
  };
}