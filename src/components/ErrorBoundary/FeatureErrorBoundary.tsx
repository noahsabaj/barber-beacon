'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FeatureErrorDetails {
  feature: string;
  error: Error;
  errorInfo: ErrorInfo;
  timestamp: string;
  retryAttempts: number;
}

interface Props {
  children: ReactNode;
  feature: string; // Name of the feature/component
  fallback?: React.ComponentType<{
    error: Error;
    feature: string;
    resetError: () => void;
    skipFeature: () => void;
  }>;
  onError?: (errorDetails: FeatureErrorDetails) => void;
  enableSkip?: boolean; // Allow users to skip this feature
  skipMessage?: string;
  level?: 'warning' | 'error'; // Severity level
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  isSkipped: boolean;
  lastErrorTime: number;
}

export class FeatureErrorBoundary extends Component<Props, State> {
  private maxRetries = 2; // Fewer retries for feature-level errors
  private retryTimeoutMs = 3000; // 3 seconds

  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      isSkipped: false,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const now = Date.now();

    const errorDetails: FeatureErrorDetails = {
      feature: this.props.feature,
      error,
      errorInfo,
      timestamp: new Date().toISOString(),
      retryAttempts: this.state.retryCount,
    };

    this.setState({
      lastErrorTime: now,
    });

    // Log error with feature context
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔥 Feature Error - ${this.props.feature}`);
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Feature:', this.props.feature);
      console.groupEnd();
    }

    // Call error callback if provided
    if (this.props.onError) {
      try {
        this.props.onError(errorDetails);
      } catch (callbackError) {
        console.error('Feature error callback failed:', callbackError);
      }
    }

    // Report to monitoring service
    this.reportFeatureError(errorDetails);
  }

  private async reportFeatureError(errorDetails: FeatureErrorDetails) {
    try {
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'feature_error',
          feature: errorDetails.feature,
          message: errorDetails.error.message,
          stack: errorDetails.error.stack,
          componentStack: errorDetails.errorInfo.componentStack,
          timestamp: errorDetails.timestamp,
          retryAttempts: errorDetails.retryAttempts,
          url: window.location.href,
        }),
      });
    } catch (reportingError) {
      console.error('Failed to report feature error:', reportingError);
    }
  }

  private handleRetry = () => {
    const { retryCount, lastErrorTime } = this.state;
    const now = Date.now();

    // Check if enough time has passed since last error
    if (now - lastErrorTime < this.retryTimeoutMs) {
      return;
    }

    // Check if we've exceeded max retries
    if (retryCount >= this.maxRetries) {
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      retryCount: retryCount + 1,
      lastErrorTime: 0,
    });
  };

  private handleSkip = () => {
    this.setState({
      isSkipped: true,
    });
  };

  private canRetry(): boolean {
    const { retryCount, lastErrorTime } = this.state;
    const now = Date.now();

    return (
      retryCount < this.maxRetries &&
      (lastErrorTime === 0 || now - lastErrorTime >= this.retryTimeoutMs)
    );
  }

  override render() {
    const {
      children,
      feature,
      fallback: FallbackComponent,
      enableSkip = true,
      skipMessage,
      level = 'error'
    } = this.props;
    const { hasError, error, retryCount, isSkipped } = this.state;

    // If feature is skipped, render nothing
    if (isSkipped) {
      return null;
    }

    if (hasError && error) {
      // Use custom fallback if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            feature={feature}
            resetError={this.handleRetry}
            skipFeature={this.handleSkip}
          />
        );
      }

      // Default feature error UI
      const isWarning = level === 'warning';
      const variant = isWarning ? 'default' : 'destructive';

      return (
        <div className="w-full p-4">
          <Alert variant={variant}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {isWarning ? 'Feature Unavailable' : 'Feature Error'}
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>
                {isWarning
                  ? `The ${feature} feature is currently unavailable.`
                  : `An error occurred in the ${feature} feature.`
                }
              </p>

              {/* Error message for development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="bg-background/50 p-2 rounded text-sm font-mono">
                  {error.message}
                </div>
              )}

              {/* Retry information */}
              {retryCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Retry attempt {retryCount} of {this.maxRetries}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {this.canRetry() && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.handleRetry}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Try Again
                  </Button>
                )}

                {enableSkip && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={this.handleSkip}
                  >
                    <SkipForward className="w-4 h-4 mr-1" />
                    {skipMessage || 'Skip This Feature'}
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return children;
  }
}

// HOC for wrapping features with error boundary
export function withFeatureErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  feature: string,
  options?: {
    fallback?: React.ComponentType<{
      error: Error;
      feature: string;
      resetError: () => void;
      skipFeature: () => void;
    }>;
    enableSkip?: boolean;
    skipMessage?: string;
    level?: 'warning' | 'error';
    onError?: (errorDetails: FeatureErrorDetails) => void;
  }
) {
  const WrappedComponent = (props: P) => (
    <FeatureErrorBoundary
      feature={feature}
      {...(options?.fallback && { fallback: options.fallback })}
      {...(options?.enableSkip !== undefined && { enableSkip: options.enableSkip })}
      {...(options?.skipMessage && { skipMessage: options.skipMessage })}
      {...(options?.level && { level: options.level })}
      {...(options?.onError && { onError: options.onError })}
    >
      <Component {...props} />
    </FeatureErrorBoundary>
  );

  WrappedComponent.displayName = `withFeatureErrorBoundary(${Component.displayName || Component.name}, ${feature})`;

  return WrappedComponent;
}

// Specific feature error boundaries for common features
export const AuthErrorBoundary = ({ children }: { children: ReactNode }) => (
  <FeatureErrorBoundary
    feature="Authentication"
    enableSkip={false}
    level="error"
  >
    {children}
  </FeatureErrorBoundary>
);

export const BookingErrorBoundary = ({ children }: { children: ReactNode }) => (
  <FeatureErrorBoundary
    feature="Booking"
    enableSkip={true}
    skipMessage="Continue without booking"
    level="error"
  >
    {children}
  </FeatureErrorBoundary>
);

export const SearchErrorBoundary = ({ children }: { children: ReactNode }) => (
  <FeatureErrorBoundary
    feature="Search"
    enableSkip={true}
    skipMessage="Browse all barbers"
    level="warning"
  >
    {children}
  </FeatureErrorBoundary>
);

export const MapErrorBoundary = ({ children }: { children: ReactNode }) => (
  <FeatureErrorBoundary
    feature="Map"
    enableSkip={true}
    skipMessage="Use list view"
    level="warning"
  >
    {children}
  </FeatureErrorBoundary>
);

export const PaymentErrorBoundary = ({ children }: { children: ReactNode }) => (
  <FeatureErrorBoundary
    feature="Payment Processing"
    enableSkip={false}
    level="error"
  >
    {children}
  </FeatureErrorBoundary>
);

export const ReviewErrorBoundary = ({ children }: { children: ReactNode }) => (
  <FeatureErrorBoundary
    feature="Reviews"
    enableSkip={true}
    skipMessage="Skip review section"
    level="warning"
  >
    {children}
  </FeatureErrorBoundary>
);