'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card' | 'minimal';
}

const sizeClasses = {
  sm: 'py-8 px-4',
  md: 'py-12 px-6',
  lg: 'py-16 px-8',
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = 'md',
  variant = 'default',
}: EmptyStateProps) {
  const content = (
    <div className={cn('text-center', sizeClasses[size])}>
      {/* Icon */}
      {icon && (
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || 'default'}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant || 'outline'}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'card') {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-0">
          {content}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={cn('w-full text-center py-8', className)}>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {content}
    </div>
  );
}

// Specialized empty state components
export function NoResultsFound({
  searchQuery,
  onClearSearch,
  className,
}: {
  searchQuery?: string;
  onClearSearch?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={
        <svg
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      }
      title={searchQuery ? `No results for "${searchQuery}"` : 'No results found'}
      description="Try adjusting your search or filters to find what you're looking for."
      {...(onClearSearch && {
        action: {
          label: 'Clear search',
          onClick: onClearSearch,
          variant: 'outline' as const,
        },
      })}
      {...(className && { className })}
    />
  );
}

export function NoBookingsFound({
  userType,
  onCreateBooking,
  className,
}: {
  userType: 'customer' | 'barber';
  onCreateBooking?: () => void;
  className?: string;
}) {
  const isCustomer = userType === 'customer';

  return (
    <EmptyState
      icon={
        <svg
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0V7a2 2 0 012-2h4a2 2 0 012 2v0M8 7v8a2 2 0 002 2h4a2 2 0 002-2V7M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V9a2 2 0 00-2-2h-2"
          />
        </svg>
      }
      title={isCustomer ? 'No appointments yet' : 'No bookings yet'}
      description={
        isCustomer
          ? 'Book your first appointment to get started with professional grooming services.'
          : 'You don\'t have any upcoming bookings. Check back later for new appointments.'
      }
      {...((isCustomer && onCreateBooking) && {
        action: {
          label: 'Find barbers',
          onClick: onCreateBooking,
        },
      })}
      {...(className && { className })}
    />
  );
}

export function NoFavoritesFound({
  onExplore,
  className,
}: {
  onExplore?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={
        <svg
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      }
      title="No favorites yet"
      description="Save barbers you love to quickly find them later."
      {...(onExplore && {
        action: {
          label: 'Explore barbers',
          onClick: onExplore,
        },
      })}
      {...(className && { className })}
    />
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We encountered an error while loading this content.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon={
        <svg
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      }
      title={title}
      description={description}
      {...(onRetry && {
        action: {
          label: 'Try again',
          onClick: onRetry,
        },
      })}
      variant="card"
      {...(className && { className })}
    />
  );
}