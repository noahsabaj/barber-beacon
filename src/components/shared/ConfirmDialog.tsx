'use client';

import { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  variant?: 'default' | 'destructive' | 'warning';
  icon?: ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
  icon,
  isLoading = false,
  disabled = false,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    if (disabled || isLoading) return;

    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      // Let the parent handle the error
      console.error('Confirm action failed:', error);
    }
  };

  const handleCancel = () => {
    if (isLoading) return;
    onCancel?.();
    onOpenChange(false);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return {
          confirmButton: 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
          iconColor: 'text-destructive',
        };
      case 'warning':
        return {
          confirmButton: 'bg-orange-600 hover:bg-orange-700 text-white',
          iconColor: 'text-orange-600',
        };
      default:
        return {
          confirmButton: 'bg-primary hover:bg-primary/90 text-primary-foreground',
          iconColor: 'text-primary',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {icon && (
            <div className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4', styles.iconColor)}>
              {icon}
            </div>
          )}
          <AlertDialogTitle className="text-center">{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-center">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-center sm:space-x-2">
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isLoading}
            className="mt-3 sm:mt-0"
          >
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={disabled || isLoading}
            className={cn(styles.confirmButton)}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Specialized confirm dialogs
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  itemType = 'item',
  isLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  itemName?: string;
  itemType?: string;
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete ${itemType}?`}
      description={
        itemName
          ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
          : `Are you sure you want to delete this ${itemType}? This action cannot be undone.`
      }
      confirmText="Delete"
      cancelText="Cancel"
      onConfirm={onConfirm}
      variant="destructive"
      isLoading={isLoading}
      icon={
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      }
    />
  );
}

export function CancelBookingDialog({
  open,
  onOpenChange,
  onConfirm,
  bookingDetails,
  isLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  bookingDetails?: {
    barberName: string;
    date: string;
    time: string;
  };
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cancel Appointment?"
      description={
        bookingDetails
          ? `Are you sure you want to cancel your appointment with ${bookingDetails.barberName} on ${bookingDetails.date} at ${bookingDetails.time}?`
          : 'Are you sure you want to cancel this appointment? This action cannot be undone.'
      }
      confirmText="Cancel Appointment"
      cancelText="Keep Appointment"
      onConfirm={onConfirm}
      variant="warning"
      isLoading={isLoading}
      icon={
        <svg
          className="h-6 w-6"
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
    />
  );
}

export function LogoutConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sign out?"
      description="Are you sure you want to sign out of your account?"
      confirmText="Sign out"
      cancelText="Stay signed in"
      onConfirm={onConfirm}
      variant="default"
      isLoading={isLoading}
      icon={
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      }
    />
  );
}