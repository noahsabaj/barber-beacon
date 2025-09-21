'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
  variant?: 'default' | 'inline' | 'overlay' | 'page';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const variantClasses = {
  default: 'flex items-center justify-center',
  inline: 'inline-flex items-center',
  overlay: 'fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm',
  page: 'flex items-center justify-center min-h-[400px]',
};

export function LoadingSpinner({
  size = 'md',
  className,
  text,
  variant = 'default',
}: LoadingSpinnerProps) {
  const spinnerContent = (
    <>
      <Loader2 className={cn('animate-spin', sizeClasses[size])} />
      {text && (
        <span className={cn('ml-2 text-sm text-muted-foreground', {
          'sr-only': variant === 'inline',
        })}>
          {text}
        </span>
      )}
    </>
  );

  return (
    <div className={cn(variantClasses[variant], className)}>
      {spinnerContent}
    </div>
  );
}

// Specialized loading components
export function LoadingButton({
  children,
  isLoading,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      {...props}
      disabled={isLoading || props.disabled}
      className={cn(
        'inline-flex items-center justify-center',
        isLoading && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function LoadingCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      <LoadingSpinner variant="default" text="Loading..." />
    </div>
  );
}

export function LoadingOverlay({
  isVisible,
  text = 'Loading...',
  className,
}: {
  isVisible: boolean;
  text?: string;
  className?: string;
}) {
  if (!isVisible) return null;

  return (
    <LoadingSpinner
      variant="overlay"
      text={text}
      {...(className !== undefined && { className })}
    />
  );
}

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex space-x-1', className)}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-2 w-2 rounded-full bg-current animate-pulse"
          style={{
            animationDelay: `${index * 0.2}s`,
            animationDuration: '1s',
          }}
        />
      ))}
    </div>
  );
}

export function LoadingSkeleton({
  className,
  count = 1,
}: {
  className?: string;
  count?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={cn(
            'h-4 bg-muted rounded animate-pulse',
            className
          )}
        />
      ))}
    </div>
  );
}