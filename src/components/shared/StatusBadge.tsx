'use client';

import { ReactNode } from 'react';
import { CheckCircle, Clock, XCircle, AlertCircle, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
  customConfig?: StatusConfig;
}

interface StatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon?: ReactNode;
  className?: string;
}

// Booking Status Configuration
export const bookingStatusConfig: Record<string, StatusConfig> = {
  pending: {
    label: 'Pending',
    variant: 'outline',
    icon: <Clock className="h-3 w-3" />,
    className: 'border-orange-200 text-orange-700 bg-orange-50',
  },
  confirmed: {
    label: 'Confirmed',
    variant: 'default',
    icon: <CheckCircle className="h-3 w-3" />,
    className: 'border-green-200 text-green-700 bg-green-50',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
    className: 'border-red-200 text-red-700 bg-red-50',
  },
  completed: {
    label: 'Completed',
    variant: 'secondary',
    icon: <CheckCircle className="h-3 w-3" />,
    className: 'border-blue-200 text-blue-700 bg-blue-50',
  },
  no_show: {
    label: 'No Show',
    variant: 'destructive',
    icon: <AlertCircle className="h-3 w-3" />,
    className: 'border-gray-200 text-gray-700 bg-gray-50',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'default',
    icon: <Clock className="h-3 w-3" />,
    className: 'border-purple-200 text-purple-700 bg-purple-50',
  },
};

// Payment Status Configuration
export const paymentStatusConfig: Record<string, StatusConfig> = {
  pending: {
    label: 'Payment Pending',
    variant: 'outline',
    icon: <CreditCard className="h-3 w-3" />,
    className: 'border-orange-200 text-orange-700 bg-orange-50',
  },
  paid: {
    label: 'Paid',
    variant: 'default',
    icon: <CheckCircle className="h-3 w-3" />,
    className: 'border-green-200 text-green-700 bg-green-50',
  },
  failed: {
    label: 'Payment Failed',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
    className: 'border-red-200 text-red-700 bg-red-50',
  },
  refunded: {
    label: 'Refunded',
    variant: 'secondary',
    icon: <AlertCircle className="h-3 w-3" />,
    className: 'border-blue-200 text-blue-700 bg-blue-50',
  },
  processing: {
    label: 'Processing',
    variant: 'outline',
    icon: <Clock className="h-3 w-3" />,
    className: 'border-purple-200 text-purple-700 bg-purple-50',
  },
};

// User Status Configuration
export const userStatusConfig: Record<string, StatusConfig> = {
  active: {
    label: 'Active',
    variant: 'default',
    icon: <CheckCircle className="h-3 w-3" />,
    className: 'border-green-200 text-green-700 bg-green-50',
  },
  inactive: {
    label: 'Inactive',
    variant: 'secondary',
    icon: <Clock className="h-3 w-3" />,
    className: 'border-gray-200 text-gray-700 bg-gray-50',
  },
  suspended: {
    label: 'Suspended',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
    className: 'border-red-200 text-red-700 bg-red-50',
  },
  pending_verification: {
    label: 'Pending Verification',
    variant: 'outline',
    icon: <AlertCircle className="h-3 w-3" />,
    className: 'border-orange-200 text-orange-700 bg-orange-50',
  },
};

// General Purpose Configuration
export const generalStatusConfig: Record<string, StatusConfig> = {
  available: {
    label: 'Available',
    variant: 'default',
    icon: <CheckCircle className="h-3 w-3" />,
    className: 'border-green-200 text-green-700 bg-green-50',
  },
  unavailable: {
    label: 'Unavailable',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
    className: 'border-red-200 text-red-700 bg-red-50',
  },
  busy: {
    label: 'Busy',
    variant: 'outline',
    icon: <Clock className="h-3 w-3" />,
    className: 'border-orange-200 text-orange-700 bg-orange-50',
  },
  online: {
    label: 'Online',
    variant: 'default',
    icon: <CheckCircle className="h-3 w-3" />,
    className: 'border-green-200 text-green-700 bg-green-50',
  },
  offline: {
    label: 'Offline',
    variant: 'secondary',
    icon: <XCircle className="h-3 w-3" />,
    className: 'border-gray-200 text-gray-700 bg-gray-50',
  },
};

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export function StatusBadge({
  status,
  variant = 'default',
  size = 'md',
  showIcon = true,
  className,
  customConfig,
}: StatusBadgeProps) {
  // Use custom config if provided, otherwise try to find in predefined configs
  const config = customConfig ||
    bookingStatusConfig[status] ||
    paymentStatusConfig[status] ||
    userStatusConfig[status] ||
    generalStatusConfig[status] ||
    {
      label: status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      variant,
      icon: undefined,
      className: '',
    };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'inline-flex items-center gap-1 font-medium',
        sizeClasses[size],
        config.className,
        className
      )}
    >
      {showIcon && config.icon}
      {config.label}
    </Badge>
  );
}

// Specialized Status Badge Components
interface BookingStatusBadgeProps {
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'in_progress';
  size?: StatusBadgeProps['size'];
  showIcon?: boolean;
  className?: string;
}

export function BookingStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className,
}: BookingStatusBadgeProps) {
  return (
    <StatusBadge
      status={status}
      size={size}
      showIcon={showIcon}
      {...(className !== undefined && { className })}
      {...(bookingStatusConfig[status] && { customConfig: bookingStatusConfig[status] })}
    />
  );
}

interface PaymentStatusBadgeProps {
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'processing';
  size?: StatusBadgeProps['size'];
  showIcon?: boolean;
  className?: string;
}

export function PaymentStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className,
}: PaymentStatusBadgeProps) {
  return (
    <StatusBadge
      status={status}
      size={size}
      showIcon={showIcon}
      {...(className !== undefined && { className })}
      {...(paymentStatusConfig[status] && { customConfig: paymentStatusConfig[status] })}
    />
  );
}

interface UserStatusBadgeProps {
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  size?: StatusBadgeProps['size'];
  showIcon?: boolean;
  className?: string;
}

export function UserStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className,
}: UserStatusBadgeProps) {
  return (
    <StatusBadge
      status={status}
      size={size}
      showIcon={showIcon}
      {...(className !== undefined && { className })}
      {...(userStatusConfig[status] && { customConfig: userStatusConfig[status] })}
    />
  );
}

// Priority Badge for urgent items
interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'urgent';
  size?: StatusBadgeProps['size'];
  showIcon?: boolean;
  className?: string;
}

const priorityConfig: Record<string, StatusConfig> = {
  low: {
    label: 'Low',
    variant: 'secondary',
    icon: <AlertCircle className="h-3 w-3" />,
    className: 'border-gray-200 text-gray-700 bg-gray-50',
  },
  medium: {
    label: 'Medium',
    variant: 'outline',
    icon: <AlertCircle className="h-3 w-3" />,
    className: 'border-blue-200 text-blue-700 bg-blue-50',
  },
  high: {
    label: 'High',
    variant: 'default',
    icon: <AlertCircle className="h-3 w-3" />,
    className: 'border-orange-200 text-orange-700 bg-orange-50',
  },
  urgent: {
    label: 'Urgent',
    variant: 'destructive',
    icon: <AlertCircle className="h-3 w-3" />,
    className: 'border-red-200 text-red-700 bg-red-50',
  },
};

export function PriorityBadge({
  priority,
  size = 'md',
  showIcon = true,
  className,
}: PriorityBadgeProps) {
  return (
    <StatusBadge
      status={priority}
      size={size}
      showIcon={showIcon}
      {...(className !== undefined && { className })}
      {...(priorityConfig[priority] && { customConfig: priorityConfig[priority] })}
    />
  );
}