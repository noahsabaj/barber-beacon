'use client';

import { ReactNode, forwardRef } from 'react';
import { FieldError, FieldErrorsImpl, Merge } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl<any>>;
  helpText?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  required = false,
  error,
  helpText,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {children}

      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}

      {error && (
        <p className="text-sm text-destructive">{error.message?.toString()}</p>
      )}
    </div>
  );
}

// Text Input Field
interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl<any>>;
  helpText?: string;
  required?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ id, label, error, helpText, required, className, ...props }, ref) => {
    return (
      <FormField
        id={id || props.name || ''}
        label={label}
        {...(required !== undefined && { required })}
        {...(error !== undefined && { error })}
        {...(helpText !== undefined && { helpText })}
        {...(className !== undefined && { className })}
      >
        <Input
          id={id || props.name}
          ref={ref}
          className={cn(error && 'border-destructive')}
          {...props}
        />
      </FormField>
    );
  }
);
TextField.displayName = 'TextField';

// Textarea Field
interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl<any>>;
  helpText?: string;
  required?: boolean;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ id, label, error, helpText, required, className, ...props }, ref) => {
    return (
      <FormField
        id={id || props.name || ''}
        label={label}
        {...(required !== undefined && { required })}
        {...(error !== undefined && { error })}
        {...(helpText !== undefined && { helpText })}
        {...(className !== undefined && { className })}
      >
        <Textarea
          id={id || props.name}
          ref={ref}
          className={cn(error && 'border-destructive')}
          {...props}
        />
      </FormField>
    );
  }
);
TextareaField.displayName = 'TextareaField';

// Select Field
interface SelectFieldProps {
  id?: string;
  name?: string;
  label: string;
  placeholder?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  onValueChange?: (value: string) => void;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl<any>>;
  helpText?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function SelectField({
  id,
  name,
  label,
  placeholder = 'Select an option',
  options,
  value,
  onValueChange,
  error,
  helpText,
  required,
  className,
  disabled,
}: SelectFieldProps) {
  return (
    <FormField
      id={id || name || ''}
      label={label}
      {...(required !== undefined && { required })}
      {...(error !== undefined && { error })}
      {...(helpText !== undefined && { helpText })}
      {...(className !== undefined && { className })}
    >
      <Select
        {...(value !== undefined && { value })}
        {...(onValueChange !== undefined && { onValueChange })}
        {...(disabled !== undefined && { disabled })}
      >
        <SelectTrigger className={cn(error && 'border-destructive')}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              {...(option.disabled !== undefined && { disabled: option.disabled })}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

// Checkbox Field
interface CheckboxFieldProps {
  id?: string;
  name?: string;
  label: string;
  description?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl<any>>;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export function CheckboxField({
  id,
  name,
  label,
  description,
  checked,
  onCheckedChange,
  error,
  required,
  className,
  disabled,
}: CheckboxFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-start space-x-2">
        <Checkbox
          {...(id || name ? { id: id || name } : {})}
          {...(checked !== undefined && { checked })}
          {...(onCheckedChange !== undefined && { onCheckedChange })}
          {...(disabled !== undefined && { disabled })}
          className={cn(error && 'border-destructive')}
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor={id || name}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error.message?.toString()}</p>
      )}
    </div>
  );
}

// Phone Number Field
interface PhoneFieldProps extends Omit<TextFieldProps, 'type'> {
  format?: 'US' | 'international';
}

export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(
  ({ format = 'US', ...props }, ref) => {
    const placeholder = format === 'US' ? '(555) 123-4567' : '+1 555 123 4567';

    return (
      <TextField
        {...props}
        ref={ref}
        type="tel"
        placeholder={placeholder}
      />
    );
  }
);
PhoneField.displayName = 'PhoneField';

// Email Field
export const EmailField = forwardRef<HTMLInputElement, TextFieldProps>(
  (props, ref) => {
    return (
      <TextField
        {...props}
        ref={ref}
        type="email"
        placeholder="Enter email address"
      />
    );
  }
);
EmailField.displayName = 'EmailField';

// Password Field
interface PasswordFieldProps extends TextFieldProps {
  showToggle?: boolean;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ showToggle = true, ...props }, ref) => {
    return (
      <TextField
        {...props}
        ref={ref}
        type="password"
        placeholder="Enter password"
      />
    );
  }
);
PasswordField.displayName = 'PasswordField';

// Number Field
interface NumberFieldProps extends Omit<TextFieldProps, 'type'> {
  min?: number;
  max?: number;
  step?: number;
}

export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ min, max, step, ...props }, ref) => {
    return (
      <TextField
        {...props}
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
      />
    );
  }
);
NumberField.displayName = 'NumberField';

// Date Field
export const DateField = forwardRef<HTMLInputElement, TextFieldProps>(
  (props, ref) => {
    return (
      <TextField
        {...props}
        ref={ref}
        type="date"
      />
    );
  }
);
DateField.displayName = 'DateField';

// Time Field
export const TimeField = forwardRef<HTMLInputElement, TextFieldProps>(
  (props, ref) => {
    return (
      <TextField
        {...props}
        ref={ref}
        type="time"
      />
    );
  }
);
TimeField.displayName = 'TimeField';