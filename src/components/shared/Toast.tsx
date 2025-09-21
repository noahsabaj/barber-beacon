'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface ToastProps extends Toast {
  onDismiss: (id: string) => void;
}

const typeConfig = {
  success: {
    icon: CheckCircle,
    className: 'border-green-200 bg-green-50 text-green-900',
    iconClassName: 'text-green-500',
  },
  error: {
    icon: AlertCircle,
    className: 'border-red-200 bg-red-50 text-red-900',
    iconClassName: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-orange-200 bg-orange-50 text-orange-900',
    iconClassName: 'text-orange-500',
  },
  info: {
    icon: Info,
    className: 'border-blue-200 bg-blue-50 text-blue-900',
    iconClassName: 'text-blue-500',
  },
};

export function ToastComponent({
  id,
  title,
  description,
  type = 'info',
  duration = 5000,
  action,
  dismissible = true,
  onDismiss,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const config = typeConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    setIsVisible(true);

    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
    return () => {}; // No cleanup needed when duration is 0
  }, [duration]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onDismiss(id);
    }, 150);
  };

  return (
    <div
      className={cn(
        'relative flex w-full max-w-sm items-start space-x-3 rounded-lg border p-4 shadow-lg transition-all duration-150',
        config.className,
        isVisible && !isLeaving && 'animate-in slide-in-from-right-full',
        isLeaving && 'animate-out slide-out-to-right-full'
      )}
    >
      {/* Icon */}
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconClassName)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mt-1 text-sm opacity-90">{description}</p>
        )}
        {action && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={action.onClick}
              className="h-8 px-3 text-xs"
            >
              {action.label}
            </Button>
          </div>
        )}
      </div>

      {/* Dismiss button */}
      {dismissible && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-0 right-0 z-50 flex flex-col space-y-2 p-4 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastComponent {...toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body
  );
}

// Toast hook for managing toast state
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const dismissAll = () => {
    setToasts([]);
  };

  // Convenience methods
  const success = (title: string, description?: string, options?: Partial<Toast>) =>
    addToast({ type: 'success', title, ...(description !== undefined && { description }), ...options });

  const error = (title: string, description?: string, options?: Partial<Toast>) =>
    addToast({ type: 'error', title, ...(description !== undefined && { description }), ...options });

  const warning = (title: string, description?: string, options?: Partial<Toast>) =>
    addToast({ type: 'warning', title, ...(description !== undefined && { description }), ...options });

  const info = (title: string, description?: string, options?: Partial<Toast>) =>
    addToast({ type: 'info', title, ...(description !== undefined && { description }), ...options });

  return {
    toasts,
    addToast,
    dismissToast,
    dismissAll,
    success,
    error,
    warning,
    info,
  };
}

// Toast Provider for global access
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();

  return (
    <>
      {children}
      <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
    </>
  );
}