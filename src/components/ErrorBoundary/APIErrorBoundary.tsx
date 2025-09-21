'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Wifi, WifiOff, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface APIError extends Error {
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  response?: any;
}

interface APIErrorDetails {
  error: APIError;
  errorInfo: ErrorInfo;
  timestamp: string;
  retryAttempts: number;
  isNetworkError: boolean;
  isServerError: boolean;
  isClientError: boolean;
}

interface Props {
  children: ReactNode;
  apiEndpoint?: string; // API endpoint being called
  fallback?: React.ComponentType<{
    error: APIError;
    resetError: () => void;
    errorType: 'network' | 'server' | 'client' | 'unknown';
  }>;
  onError?: (errorDetails: APIErrorDetails) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  showNetworkStatus?: boolean;
}

interface State {
  hasError: boolean;
  error: APIError | null;
  retryCount: number;
  isRetrying: boolean;
  lastErrorTime: number;
  networkStatus: 'online' | 'offline' | 'slow';
}

export class APIErrorBoundary extends Component<Props, State> {
  private defaultMaxRetries = 3;
  private defaultRetryDelay = 2000; // 2 seconds
  private networkCheckInterval: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      isRetrying: false,
      lastErrorTime: 0,
      networkStatus: navigator.onLine ? 'online' : 'offline',
    };
  }

  override componentDidMount() {
    // Set up network status monitoring
    this.setupNetworkMonitoring();
  }

  override componentWillUnmount() {
    // Clean up network monitoring
    if (this.networkCheckInterval) {
      clearInterval(this.networkCheckInterval);
    }
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error: error as APIError,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const apiError = error as APIError;
    const now = Date.now();

    const errorDetails: APIErrorDetails = {
      error: apiError,
      errorInfo,
      timestamp: new Date().toISOString(),
      retryAttempts: this.state.retryCount,
      isNetworkError: this.isNetworkError(apiError),
      isServerError: this.isServerError(apiError),
      isClientError: this.isClientError(apiError),
    };

    this.setState({
      lastErrorTime: now,
    });

    // Log API error with detailed context
    if (process.env.NODE_ENV === 'development') {
      console.group(`🌐 API Error - ${this.props.apiEndpoint || 'Unknown'}`);
      console.error('API Error:', apiError);
      console.error('Status:', apiError.status);
      console.error('URL:', apiError.url);
      console.error('Method:', apiError.method);
      console.error('Response:', apiError.response);
      console.error('Error Info:', errorInfo);
      console.groupEnd();
    }

    // Call error callback if provided
    if (this.props.onError) {
      try {
        this.props.onError(errorDetails);
      } catch (callbackError) {
        console.error('API error callback failed:', callbackError);
      }
    }

    // Report to monitoring service
    this.reportAPIError(errorDetails);

    // Auto-retry for certain error types
    if (this.shouldAutoRetry(apiError)) {
      this.scheduleRetry();
    }
  }

  private setupNetworkMonitoring() {
    // Online/offline detection
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Network speed detection
    this.networkCheckInterval = setInterval(() => {
      this.checkNetworkSpeed();
    }, 30000); // Check every 30 seconds
  }

  private handleOnline = () => {
    this.setState({ networkStatus: 'online' });

    // Auto-retry if we have a network error
    if (this.state.hasError && this.state.error && this.isNetworkError(this.state.error)) {
      this.handleRetry();
    }
  };

  private handleOffline = () => {
    this.setState({ networkStatus: 'offline' });
  };

  private async checkNetworkSpeed() {
    if (!navigator.onLine) return;

    try {
      const start = Date.now();
      await fetch('/api/health', { method: 'HEAD' });
      const duration = Date.now() - start;

      this.setState({
        networkStatus: duration > 3000 ? 'slow' : 'online'
      });
    } catch {
      this.setState({ networkStatus: 'slow' });
    }
  }

  private isNetworkError(error: APIError): boolean {
    return (
      !navigator.onLine ||
      error.message.includes('NetworkError') ||
      error.message.includes('Failed to fetch') ||
      error.status === 0
    );
  }

  private isServerError(error: APIError): boolean {
    return !!(error.status && error.status >= 500);
  }

  private isClientError(error: APIError): boolean {
    return !!(error.status && error.status >= 400 && error.status < 500);
  }

  private shouldAutoRetry(error: APIError): boolean {
    const { enableRetry = true } = this.props;

    if (!enableRetry) return false;

    // Retry network errors and 5xx server errors
    return this.isNetworkError(error) || this.isServerError(error);
  }

  private scheduleRetry() {
    const { maxRetries = this.defaultMaxRetries, retryDelay = this.defaultRetryDelay } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) return;

    this.setState({ isRetrying: true });

    setTimeout(() => {
      this.handleRetry();
    }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
  }

  private async reportAPIError(errorDetails: APIErrorDetails) {
    try {
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'api_error',
          endpoint: this.props.apiEndpoint,
          status: errorDetails.error.status,
          statusText: errorDetails.error.statusText,
          url: errorDetails.error.url,
          method: errorDetails.error.method,
          message: errorDetails.error.message,
          timestamp: errorDetails.timestamp,
          retryAttempts: errorDetails.retryAttempts,
          isNetworkError: errorDetails.isNetworkError,
          isServerError: errorDetails.isServerError,
          isClientError: errorDetails.isClientError,
        }),
      });
    } catch (reportingError) {
      console.error('Failed to report API error:', reportingError);
    }
  }

  private handleRetry = () => {
    const { maxRetries = this.defaultMaxRetries } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) return;

    this.setState({
      hasError: false,
      error: null,
      retryCount: retryCount + 1,
      isRetrying: false,
      lastErrorTime: 0,
    });
  };

  private getErrorType(): 'network' | 'server' | 'client' | 'unknown' {
    const { error } = this.state;
    if (!error) return 'unknown';

    if (this.isNetworkError(error)) return 'network';
    if (this.isServerError(error)) return 'server';
    if (this.isClientError(error)) return 'client';
    return 'unknown';
  }

  private getErrorIcon() {
    const errorType = this.getErrorType();
    const { networkStatus } = this.state;

    switch (errorType) {
      case 'network':
        return networkStatus === 'offline' ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />;
      case 'server':
        return <Server className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  }

  private getErrorMessage(): string {
    const { error, networkStatus } = this.state;
    const errorType = this.getErrorType();

    switch (errorType) {
      case 'network':
        if (networkStatus === 'offline') {
          return 'You are currently offline. Please check your internet connection.';
        }
        if (networkStatus === 'slow') {
          return 'Your connection appears to be slow. Please wait or try again.';
        }
        return 'Network error occurred. Please check your connection and try again.';

      case 'server':
        return 'Our servers are experiencing issues. Please try again in a few moments.';

      case 'client':
        if (error?.status === 401) {
          return 'Authentication failed. Please log in again.';
        }
        if (error?.status === 403) {
          return 'You do not have permission to access this resource.';
        }
        if (error?.status === 404) {
          return 'The requested resource was not found.';
        }
        return 'Request failed. Please check your input and try again.';

      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private canRetry(): boolean {
    const { enableRetry = true, maxRetries = this.defaultMaxRetries } = this.props;
    const { retryCount, networkStatus } = this.state;
    const errorType = this.getErrorType();

    if (!enableRetry) return false;
    if (retryCount >= maxRetries) return false;
    if (errorType === 'network' && networkStatus === 'offline') return false;
    if (errorType === 'client' && this.state.error?.status === 403) return false;

    return true;
  }

  override render() {
    const { children, fallback: FallbackComponent, showNetworkStatus = true } = this.props;
    const { hasError, error, retryCount, isRetrying, networkStatus } = this.state;

    if (hasError && error) {
      const errorType = this.getErrorType();

      // Use custom fallback if provided
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            resetError={this.handleRetry}
            errorType={errorType}
          />
        );
      }

      // Default API error UI
      return (
        <div className="w-full p-4">
          <Alert variant="destructive">
            {this.getErrorIcon()}
            <AlertTitle>API Error</AlertTitle>
            <AlertDescription className="mt-2 space-y-3">
              <p>{this.getErrorMessage()}</p>

              {/* Network status indicator */}
              {showNetworkStatus && (
                <div className="flex items-center gap-2 text-sm">
                  <span>Connection:</span>
                  <span className={`font-medium ${
                    networkStatus === 'online' ? 'text-green-600' :
                    networkStatus === 'slow' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {networkStatus === 'online' ? 'Good' :
                     networkStatus === 'slow' ? 'Slow' :
                     'Offline'}
                  </span>
                </div>
              )}

              {/* Error details for development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="bg-background/50 p-2 rounded text-sm font-mono">
                  {error.status && `${error.status} ${error.statusText || ''}`}
                  {error.url && ` - ${error.url}`}
                </div>
              )}

              {/* Retry information */}
              {retryCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Retry attempt {retryCount} of {this.props.maxRetries || this.defaultMaxRetries}
                </p>
              )}

              {/* Retry button */}
              {this.canRetry() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleRetry}
                  disabled={isRetrying}
                >
                  <RefreshCw className={`w-4 h-4 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                  {isRetrying ? 'Retrying...' : 'Try Again'}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return children;
  }
}

// HOC for wrapping API calls with error boundary
export function withAPIErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  apiEndpoint?: string,
  options?: {
    fallback?: React.ComponentType<{
      error: APIError;
      resetError: () => void;
      errorType: 'network' | 'server' | 'client' | 'unknown';
    }>;
    enableRetry?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    showNetworkStatus?: boolean;
    onError?: (errorDetails: APIErrorDetails) => void;
  }
) {
  const WrappedComponent = (props: P) => (
    <APIErrorBoundary
      {...(apiEndpoint && { apiEndpoint })}
      {...(options?.fallback && { fallback: options.fallback })}
      {...(options?.enableRetry !== undefined && { enableRetry: options.enableRetry })}
      {...(options?.maxRetries !== undefined && { maxRetries: options.maxRetries })}
      {...(options?.retryDelay !== undefined && { retryDelay: options.retryDelay })}
      {...(options?.showNetworkStatus !== undefined && { showNetworkStatus: options.showNetworkStatus })}
      {...(options?.onError && { onError: options.onError })}
    >
      <Component {...props} />
    </APIErrorBoundary>
  );

  WrappedComponent.displayName = `withAPIErrorBoundary(${Component.displayName || Component.name}, ${apiEndpoint})`;

  return WrappedComponent;
}