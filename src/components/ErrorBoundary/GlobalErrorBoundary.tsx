'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  errorBoundary?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
}

interface Props {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableReporting?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorDetails: ErrorDetails | null;
  retryCount: number;
  lastErrorTime: number;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeoutMs = 5000; // 5 seconds

  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorDetails: null,
      retryCount: 0,
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

    // Create detailed error information
    const userId = this.getCurrentUserId();
    const errorDetails: ErrorDetails = {
      message: error.message,
      ...(error.stack && { stack: error.stack }),
      ...(errorInfo.componentStack !== null && { componentStack: errorInfo.componentStack }),
      errorBoundary: 'GlobalErrorBoundary',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...(userId !== undefined && { userId }),
    };

    this.setState({
      errorDetails,
      lastErrorTime: now,
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Global Error Boundary');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Error Details:', errorDetails);
      console.groupEnd();
    }

    // Report error to external service if enabled
    if (this.props.enableReporting && this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (reportingError) {
        console.error('Failed to report error:', reportingError);
      }
    }

    // Send error to analytics/monitoring service
    this.reportError(errorDetails);
  }

  private getCurrentUserId(): string | undefined {
    try {
      // Try to get user ID from local storage or auth store
      const token = localStorage.getItem('token');
      if (token) {
        const parts = token.split('.');
        if (parts[1]) {
          const payload = JSON.parse(atob(parts[1]));
          return payload.userId || payload.id;
        }
      }
    } catch {
      // Ignore errors when getting user ID
    }
    return undefined;
  }

  private async reportError(errorDetails: ErrorDetails) {
    try {
      // Send error to monitoring endpoint
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'global_error',
          ...errorDetails,
        }),
      });
    } catch (reportingError) {
      console.error('Failed to report error to monitoring service:', reportingError);
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
      this.handleReload();
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorDetails: null,
      retryCount: retryCount + 1,
      lastErrorTime: 0,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReportIssue = () => {
    const { errorDetails } = this.state;

    if (errorDetails) {
      // Create GitHub issue or support ticket
      const issueBody = `
**Error Details:**
- Message: ${errorDetails.message}
- Timestamp: ${errorDetails.timestamp}
- URL: ${errorDetails.url}
- User Agent: ${errorDetails.userAgent}

**Stack Trace:**
\`\`\`
${errorDetails.stack}
\`\`\`

**Component Stack:**
\`\`\`
${errorDetails.componentStack}
\`\`\`
      `.trim();

      const githubUrl = `https://github.com/your-org/barber-beacon/issues/new?title=Global%20Error%20Boundary%20Triggered&body=${encodeURIComponent(issueBody)}`;
      window.open(githubUrl, '_blank');
    }
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
    const { hasError, error, errorDetails, retryCount } = this.state;
    const { children, fallback: FallbackComponent } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            resetError={this.handleRetry}
          />
        );
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. We apologize for the inconvenience.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Error Summary */}
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error Details</AlertTitle>
                <AlertDescription className="mt-2">
                  <code className="text-sm bg-background/50 px-2 py-1 rounded">
                    {error.message}
                  </code>
                </AlertDescription>
              </Alert>

              {/* Retry Information */}
              {retryCount > 0 && (
                <Alert>
                  <AlertDescription>
                    Retry attempt {retryCount} of {this.maxRetries}
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                {this.canRetry() ? (
                  <Button
                    onClick={this.handleRetry}
                    className="flex-1"
                    variant="default"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                ) : (
                  <Button
                    onClick={this.handleReload}
                    className="flex-1"
                    variant="default"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload Page
                  </Button>
                )}

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>

                <Button
                  onClick={this.handleReportIssue}
                  variant="outline"
                  className="flex-1"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Report Issue
                </Button>
              </div>

              {/* Development Error Details */}
              {process.env.NODE_ENV === 'development' && errorDetails && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-medium mb-2">
                    Development Error Details
                  </summary>
                  <div className="bg-muted p-4 rounded-lg overflow-auto">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(errorDetails, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {/* Error Stack Trace (Development Only) */}
              {process.env.NODE_ENV === 'development' && error.stack && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium mb-2">
                    Stack Trace
                  </summary>
                  <div className="bg-muted p-4 rounded-lg overflow-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {error.stack}
                    </pre>
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// HOC for wrapping components with error boundary
export function withGlobalErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
) {
  const WrappedComponent = (props: P) => (
    <GlobalErrorBoundary {...(fallback && { fallback })}>
      <Component {...props} />
    </GlobalErrorBoundary>
  );

  WrappedComponent.displayName = `withGlobalErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// React 18 Error Boundary Hook (for functional components)
export function useErrorHandler() {
  return (error: Error, _errorInfo?: ErrorInfo) => {
    // This would trigger the nearest error boundary
    throw error;
  };
}