'use client';

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
  className?: string;
  overlayClassName?: string;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-none w-full h-full m-0 rounded-none',
};

export function Modal({
  open,
  onOpenChange,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnEscape = true,
  closeOnClickOutside = true,
  className,
  overlayClassName,
}: ModalProps) {
  const handleClose = () => onOpenChange(false);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        handleClose();
      }
    };

    if (closeOnEscape) {
      document.addEventListener('keydown', handleEscape);
    }

    // Prevent scrolling when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, closeOnEscape]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/80 backdrop-blur-sm',
          overlayClassName
        )}
        onClick={closeOnClickOutside ? handleClose : undefined}
      />

      {/* Modal Content */}
      <div
        className={cn(
          'relative bg-background rounded-lg shadow-lg border',
          'max-h-[90vh] overflow-auto',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          sizeClasses[size],
          size !== 'full' && 'mx-4',
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClose}
            className="absolute right-2 top-2 h-8 w-8 p-0 z-10"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

interface ModalHeaderProps {
  children: ReactNode;
  className?: string;
}

export function ModalHeader({ children, className }: ModalHeaderProps) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-6 pb-0', className)}>
      {children}
    </div>
  );
}

interface ModalTitleProps {
  children: ReactNode;
  className?: string;
}

export function ModalTitle({ children, className }: ModalTitleProps) {
  return (
    <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>
      {children}
    </h2>
  );
}

interface ModalDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function ModalDescription({ children, className }: ModalDescriptionProps) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      {children}
    </p>
  );
}

interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn('p-6', className)}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn('flex items-center justify-end space-x-2 p-6 pt-0', className)}>
      {children}
    </div>
  );
}

// Specialized Modal Components
interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit?: () => void;
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
  isLoading?: boolean;
  size?: ModalProps['size'];
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  onCancel,
  submitText = 'Save',
  cancelText = 'Cancel',
  isLoading = false,
  size = 'md',
}: FormModalProps) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} size={size}>
      <ModalHeader>
        <ModalTitle>{title}</ModalTitle>
        {description && <ModalDescription>{description}</ModalDescription>}
      </ModalHeader>
      <ModalBody>{children}</ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button onClick={onSubmit} disabled={isLoading}>
          {isLoading ? 'Saving...' : submitText}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

interface ImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
  title?: string;
}

export function ImageModal({
  open,
  onOpenChange,
  src,
  alt,
  title,
}: ImageModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      className="bg-black/90 flex items-center justify-center"
    >
      <div className="relative max-w-7xl max-h-full p-4">
        {title && (
          <div className="text-white text-center mb-4">
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        )}
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </div>
    </Modal>
  );
}