import { User, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { UserRepository } from '../repositories/UserRepository';
import { CacheManager } from '../base/CacheManager';
import { MetricsCollector } from '../base/MetricsCollector';
import { NotificationService } from './NotificationService';
import {
  AuthenticationError,
  ValidationError,
  ConflictError
} from '../base/ApiError';
import {
  signToken as generateAccessToken,
  verifyToken as verifyRefreshToken
} from '../../jwt';
import { validatePassword, VALIDATION_RULES } from '../../validation-constants';
import { PublicUserProfile } from '../types/entities';

// For now, use the same function for refresh tokens
const generateRefreshToken = generateAccessToken;

export interface RegisterUserParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phoneNumber?: string | undefined;
  acceptedTerms: boolean;
  marketingConsent?: boolean | undefined;
}

export interface LoginParams {
  email: string;
  password: string;
  rememberMe?: boolean | undefined;
  deviceInfo?: {
    userAgent: string;
    ipAddress: string;
    deviceType: 'mobile' | 'desktop' | 'tablet';
  } | undefined;
}

export interface LoginResult {
  user: PublicUserProfile;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  requiresVerification?: boolean;
  requires2FA?: boolean;
}

export interface PasswordResetParams {
  email: string;
  newPassword: string;
  resetToken: string;
}

export interface UpdateProfileParams {
  userId: string;
  updates: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
  };
}

export interface ChangePasswordParams {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface TwoFactorSetupParams {
  userId: string;
  secret: string;
  code: string;
}

export interface TwoFactorVerifyParams {
  userId: string;
  code: string;
}

export interface SessionInfo {
  userId: string;
  sessionId: string;
  deviceInfo: any;
  createdAt: Date;
  lastActivity: Date;
  ipAddress: string;
  isActive: boolean;
}

export interface UserSecurityInfo {
  userId: string;
  lastPasswordChange: Date;
  loginAttempts: number;
  isLocked: boolean;
  lockExpiration?: Date;
  twoFactorEnabled: boolean;
  activeSessions: number;
  lastLogin?: Date;
  securityEvents: Array<{
    type: string;
    timestamp: Date;
    ipAddress: string;
    userAgent: string;
  }>;
}

export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 30;
  private readonly PASSWORD_RESET_EXPIRY_MINUTES = 60;

  constructor(
    private userRepository: UserRepository,
    private cacheManager: CacheManager,
    private metricsCollector: MetricsCollector,
    private notificationService: NotificationService
  ) {}

  // User Registration with comprehensive validation
  async registerUser(params: RegisterUserParams): Promise<LoginResult> {
    const startTime = Date.now();

    try {
      const { email, password, firstName, lastName, role, phoneNumber, acceptedTerms } = params;

      // Validate required terms acceptance
      if (!acceptedTerms) {
        throw new ValidationError('Terms and conditions must be accepted');
      }

      // Validate password strength
      const isValidPassword = validatePassword(password);
      if (!isValidPassword) {
        throw new ValidationError(`Password requirements not met: ${VALIDATION_RULES.PASSWORD.ERROR_MESSAGE}`);
      }

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Check phone number uniqueness if provided
      if (phoneNumber) {
        const existingPhone = await this.userRepository.findFirst({
          where: { phoneNumber }
        });
        if (existingPhone) {
          throw new ConflictError('User with this phone number already exists');
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      // Create user
      const userData: Prisma.UserCreateInput = {
        email: email.toLowerCase().trim(),
        password: passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        ...(phoneNumber && { phoneNumber: phoneNumber.trim() }),
        emailNotifications: true,
        smsNotifications: !!phoneNumber,
        // marketingConsent is not in the User model - removed
        // emailVerificationToken handled separately
        // emailVerificationExpiry not in User model - removed
        isEmailVerified: false,
        // lastPasswordChange not in User model - removed
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const user = await this.userRepository.create(userData);

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        id: user.id, // Legacy support
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      });
      const refreshToken = generateRefreshToken({
        userId: user.id,
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      });

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken);

      // Send verification email
      await this.notificationService.sendEmailVerification(
        user.email,
        user.firstName || 'User',
        emailVerificationToken
      );

      // Log security event
      await this.logSecurityEvent(user.id, 'REGISTRATION', {
        ipAddress: 'unknown', // Will be provided by middleware
        userAgent: 'unknown'
      });

      // Record metrics
      this.metricsCollector.recordUserAction('user_registration', user.id);
      this.metricsCollector.recordBatchOperation('create_user', 1, 100, true);

      const userWithoutPassword = this.excludePasswordFromUser(user);

      return {
        user: userWithoutPassword,
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        requiresVerification: true
      };

    } catch (error) {
      this.metricsCollector.recordError('register_user', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('register_user', Date.now() - startTime);
    }
  }

  // User Login with security features
  async loginUser(params: LoginParams): Promise<LoginResult> {
    const startTime = Date.now();

    try {
      const { email, password, rememberMe = false, deviceInfo } = params;

      // Check if account is locked
      await this.checkAccountLockout(email);

      // Find user by email
      const user = await this.userRepository.findByEmail(email.toLowerCase().trim());
      if (!user) {
        await this.recordFailedLoginAttempt(email);
        throw new AuthenticationError('Invalid email or password');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        await this.recordFailedLoginAttempt(email, user.id);
        throw new AuthenticationError('Invalid email or password');
      }

      // Clear failed attempts on successful login
      await this.clearFailedLoginAttempts(user.id);

      // Check if 2FA is enabled
      // TODO: Add twoFactorEnabled field to User model
      if ((user as any).twoFactorEnabled) {
        // For 2FA users, return a temporary token
        const tempToken = this.generateTemporary2FAToken(user.id);
        return {
          user: this.excludePasswordFromUser(user),
          accessToken: tempToken,
          refreshToken: '',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
          requires2FA: true
        };
      }

      // Generate tokens
      const tokenExpiry = rememberMe ? 30 : 1; // 30 days or 1 day
      const accessToken = generateAccessToken({
        userId: user.id,
        id: user.id, // Legacy support
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      });
      const refreshToken = generateRefreshToken({
        userId: user.id,
        id: user.id,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      });

      // Store refresh token
      await this.storeRefreshToken(user.id, refreshToken, tokenExpiry);

      // Update last activity (using updatedAt as proxy)
      await this.userRepository.updateById(user.id, {
        updatedAt: new Date()
      });

      // Log security event
      await this.logSecurityEvent(user.id, 'LOGIN', {
        ipAddress: deviceInfo?.ipAddress || 'unknown',
        userAgent: deviceInfo?.userAgent || 'unknown'
      });

      // Record metrics
      this.metricsCollector.recordUserAction('user_login', user.id);
      this.metricsCollector.recordBatchOperation('user_login_success', 1, 50, true);

      return {
        user: this.excludePasswordFromUser(user),
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + tokenExpiry * 24 * 60 * 60 * 1000),
        requiresVerification: !user.isEmailVerified
      };

    } catch (error) {
      this.metricsCollector.recordError('login_user', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('login_user', Date.now() - startTime);
    }
  }

  // Initiate password reset
  async initiatePasswordReset(email: string): Promise<void> {
    const startTime = Date.now();

    try {
      const user = await this.userRepository.findByEmail(email.toLowerCase().trim());
      if (!user) {
        // Don't reveal if email exists for security
        return;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + this.PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);

      // Store reset token in cache (since User model doesn't have these fields)
      await this.cacheManager.set(
        `password_reset:${resetToken}`,
        { userId: user.id, expiry: resetExpiry },
        this.PASSWORD_RESET_EXPIRY_MINUTES * 60 // seconds
      );

      // Send password reset email
      await this.notificationService.sendPasswordReset(
        user.email,
        user.firstName || 'User',
        resetToken
      );

      // Log security event
      await this.logSecurityEvent(user.id, 'PASSWORD_RESET_REQUESTED', {
        ipAddress: 'unknown',
        userAgent: 'unknown'
      });

      this.metricsCollector.recordUserAction('password_reset_initiated', user.id);

    } catch (error) {
      this.metricsCollector.recordError('initiate_password_reset', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('initiate_password_reset', Date.now() - startTime);
    }
  }

  // Complete password reset
  async resetPassword(params: PasswordResetParams): Promise<void> {
    const startTime = Date.now();

    try {
      const { email, newPassword, resetToken } = params;

      // Validate new password
      const isValidPassword = validatePassword(newPassword);
      if (!isValidPassword) {
        throw new ValidationError(`Password requirements not met: ${VALIDATION_RULES.PASSWORD.ERROR_MESSAGE}`);
      }

      // Find user and verify reset token
      const user = await this.userRepository.findByEmail(email.toLowerCase().trim());
      // Get reset token from cache
      const resetData = await this.cacheManager.get(`password_reset:${resetToken}`);
      if (!user || !resetData || (resetData as any).userId !== user.id) {
        throw new AuthenticationError('Invalid or expired reset token');
      }

      // Check token expiry
      if (!(user as any).passwordResetExpiry || (user as any).passwordResetExpiry < new Date()) {
        throw new AuthenticationError('Reset token has expired');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user
      await this.userRepository.updateById(user.id, {
        password: passwordHash,
        updatedAt: new Date()
      });

      // Clean up reset token from cache
      await this.cacheManager.delete(`password_reset:${resetToken}`);

      // Invalidate all sessions
      await this.invalidateAllUserSessions(user.id);

      // Send confirmation email
      await this.notificationService.sendPasswordChangeConfirmation(
        user.email,
        user.firstName || 'User'
      );

      // Log security event
      await this.logSecurityEvent(user.id, 'PASSWORD_RESET_COMPLETED', {
        ipAddress: 'unknown',
        userAgent: 'unknown'
      });

      this.metricsCollector.recordUserAction('password_reset_completed', user.id);

    } catch (error) {
      this.metricsCollector.recordError('reset_password', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('reset_password', Date.now() - startTime);
    }
  }

  // Verify email address
  async verifyEmail(token: string): Promise<PublicUserProfile> {
    const startTime = Date.now();

    try {
      // TODO: Add emailVerificationToken field to User model
      const users = await this.userRepository.findMany({ where: {} });
      const user = users.find(u => (u as any).emailVerificationToken === token);
      if (!user) {
        throw new AuthenticationError('Invalid verification token');
      }

      if (!(user as any).emailVerificationExpiry || (user as any).emailVerificationExpiry < new Date()) {
        throw new AuthenticationError('Verification token has expired');
      }

      // Update user
      const updatedUser = await this.userRepository.updateById(user.id, {
        isEmailVerified: true,
        // emailVerificationToken and expiry are not in the User model
        updatedAt: new Date()
      });

      // Send welcome email
      await this.notificationService.sendWelcome(
        user.email,
        user.firstName || 'User'
      );

      // Log security event
      await this.logSecurityEvent(user.id, 'EMAIL_VERIFIED', {
        ipAddress: 'unknown',
        userAgent: 'unknown'
      });

      this.metricsCollector.recordUserAction('email_verified', user.id);

      return this.excludePasswordFromUser(updatedUser);

    } catch (error) {
      this.metricsCollector.recordError('verify_email', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('verify_email', Date.now() - startTime);
    }
  }

  // Change password (authenticated user)
  async changePassword(params: ChangePasswordParams): Promise<void> {
    const startTime = Date.now();

    try {
      const { userId, currentPassword, newPassword } = params;

      // Get user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new AuthenticationError('Current password is incorrect');
      }

      // Validate new password
      const isValidPassword = validatePassword(newPassword);
      if (!isValidPassword) {
        throw new ValidationError(`Password requirements not met: ${VALIDATION_RULES.PASSWORD.ERROR_MESSAGE}`);
      }

      // Check if new password is different
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        throw new ValidationError('New password must be different from current password');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update user
      await this.userRepository.updateById(userId, {
        password: passwordHash,
        updatedAt: new Date()
      });

      // Invalidate all sessions except current
      await this.invalidateAllUserSessions(userId, true);

      // Send confirmation email
      await this.notificationService.sendPasswordChangeConfirmation(
        user.email,
        user.firstName || 'User'
      );

      // Log security event
      await this.logSecurityEvent(userId, 'PASSWORD_CHANGED', {
        ipAddress: 'unknown',
        userAgent: 'unknown'
      });

      this.metricsCollector.recordUserAction('password_changed', userId);

    } catch (error) {
      this.metricsCollector.recordError('change_password', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('change_password', Date.now() - startTime);
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    const startTime = Date.now();

    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);
      const userId = payload.userId;

      // Check if refresh token is stored
      const storedToken = await this.cacheManager.get(`refresh_token:${userId}`);
      if (!storedToken || storedToken !== refreshToken) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // Get user
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Generate new access token
      const accessToken = generateAccessToken({
        userId: user.id,
        id: user.id, // Legacy support
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      });

      this.metricsCollector.recordUserAction('token_refreshed', payload.userId || payload.id);

      return {
        accessToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      };

    } catch (error) {
      this.metricsCollector.recordError('refresh_access_token', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('refresh_access_token', Date.now() - startTime);
    }
  }

  // Logout user
  async logoutUser(userId: string, _refreshToken: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Remove refresh token
      await this.cacheManager.delete(`refresh_token:${userId}`);

      // Log security event
      await this.logSecurityEvent(userId, 'LOGOUT', {
        ipAddress: 'unknown',
        userAgent: 'unknown'
      });

      this.metricsCollector.recordUserAction('user_logout', userId);

    } catch (error) {
      this.metricsCollector.recordError('logout_user', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('logout_user', Date.now() - startTime);
    }
  }

  // Get user security information
  async getUserSecurityInfo(userId: string): Promise<UserSecurityInfo> {
    const startTime = Date.now();

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Get failed login attempts
      const loginAttempts = await this.cacheManager.get(`login_attempts:${userId}`) || 0;
      const lockExpiration = await this.cacheManager.get(`account_locked:${userId}`);

      // Get active sessions count
      const activeSessions = await this.getActiveSessionsCount(userId);

      // Get security events (last 30 days)
      const securityEvents = await this.getSecurityEvents(userId, 30);

      return {
        userId,
        lastPasswordChange: (user as any).lastPasswordChange || user.createdAt,
        loginAttempts: Number(loginAttempts),
        isLocked: !!lockExpiration,
        ...(lockExpiration ? { lockExpiration: new Date(String(lockExpiration)) } : {}),
        twoFactorEnabled: (user as any).twoFactorEnabled || false,
        activeSessions,
        lastLogin: (user as any).lastLogin || undefined,
        securityEvents
      };

    } catch (error) {
      this.metricsCollector.recordError('get_user_security_info', error as Error);
      throw error;
    } finally {
      this.metricsCollector.recordLatency('get_user_security_info', Date.now() - startTime);
    }
  }

  // Private helper methods
  private excludePasswordFromUser(user: User): PublicUserProfile {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role as UserRole,
      isEmailVerified: user.isEmailVerified,
      phoneNumber: user.phone || user.phoneNumber,
      createdAt: user.createdAt,
    };
  }

  private async storeRefreshToken(userId: string, token: string, expiryDays: number = 30): Promise<void> {
    const expirySeconds = expiryDays * 24 * 60 * 60;
    await this.cacheManager.set(`refresh_token:${userId}`, token, expirySeconds);
  }

  private async checkAccountLockout(email: string): Promise<void> {
    const lockExpiration = await this.cacheManager.get(`account_locked:${email}`);
    if (lockExpiration && new Date(String(lockExpiration)) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(String(lockExpiration)).getTime() - Date.now()) / (60 * 1000));
      throw new AuthenticationError(`Account is locked. Try again in ${remainingMinutes} minutes.`);
    }
  }

  private async recordFailedLoginAttempt(email: string, userId?: string): Promise<void> {
    const key = userId ? `login_attempts:${userId}` : `login_attempts:${email}`;
    const attempts = await this.cacheManager.get(key) || 0;
    const newAttempts = Number(attempts) + 1;

    await this.cacheManager.set(key, newAttempts, 3600); // 1 hour expiry

    if (newAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      const lockExpiration = new Date(Date.now() + this.LOCKOUT_DURATION_MINUTES * 60 * 1000);
      await this.cacheManager.set(`account_locked:${email}`, lockExpiration.toISOString(), this.LOCKOUT_DURATION_MINUTES * 60);

      if (userId) {
        await this.logSecurityEvent(userId, 'ACCOUNT_LOCKED', {
          ipAddress: 'unknown',
          userAgent: 'unknown'
        });
      }
    }
  }

  private async clearFailedLoginAttempts(userId: string): Promise<void> {
    await this.cacheManager.delete(`login_attempts:${userId}`);
  }

  private generateTemporary2FAToken(userId: string): string {
    // Use standard token with temp2FA flag - expires in 24h
    return generateAccessToken({ userId } as any);
  }

  private async invalidateAllUserSessions(userId: string, _exceptCurrent: boolean = false): Promise<void> {
    await this.cacheManager.delete(`refresh_token:${userId}`);
    // Additional session invalidation logic would go here
  }

  private async logSecurityEvent(userId: string, eventType: string, metadata: any): Promise<void> {
    const event = {
      userId,
      type: eventType,
      timestamp: new Date(),
      metadata
    };

    await this.cacheManager.set(
      `security_event:${userId}:${Date.now()}`,
      event,
      30 * 24 * 60 * 60 // 30 days
    );
  }

  private async getActiveSessionsCount(userId: string): Promise<number> {
    // Simplified implementation - in production, this would check actual session storage
    const hasRefreshToken = await this.cacheManager.get(`refresh_token:${userId}`);
    return hasRefreshToken ? 1 : 0;
  }

  private async getSecurityEvents(_userId: string, _days: number): Promise<Array<{ type: string; timestamp: Date; ipAddress: string; userAgent: string }>> {
    // Simplified implementation - in production, this would query actual security log storage
    return [];
  }
}