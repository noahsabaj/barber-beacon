'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

interface FormField<T> {
  value: T;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

type FormFields<T> = {
  [K in keyof T]: FormField<T[K]>;
};

type FormValues<T> = {
  [K in keyof T]: T[K];
};

type FormErrors<T> = {
  [K in keyof T]: string | null;
};

type ValidatorFunction<T> = (value: T) => string | null;
type FormValidator<T> = {
  [K in keyof T]?: ValidatorFunction<T[K]> | ValidatorFunction<T[K]>[];
};

interface UseFormOptions<T> {
  initialValues: T;
  validators?: FormValidator<T>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  onSubmit?: (values: T) => void | Promise<void>;
}

// Main form hook
export function useForm<T extends Record<string, any>>({
  initialValues,
  validators = {},
  validateOnChange = true,
  validateOnBlur = true,
  onSubmit,
}: UseFormOptions<T>) {
  const [fields, setFields] = useState<FormFields<T>>(() => {
    const initialFields = {} as FormFields<T>;
    for (const key in initialValues) {
      initialFields[key] = {
        value: initialValues[key],
        error: null,
        touched: false,
        dirty: false,
      };
    }
    return initialFields;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Validate a single field
  const validateField = useCallback((name: keyof T, value: T[keyof T]): string | null => {
    const fieldValidators = validators[name];
    if (!fieldValidators) return null;

    const validatorArray = Array.isArray(fieldValidators) ? fieldValidators : [fieldValidators];

    for (const validator of validatorArray) {
      const error = validator(value);
      if (error) return error;
    }

    return null;
  }, [validators]);

  // Validate all fields
  const validateForm = useCallback((): FormErrors<T> => {
    const errors = {} as FormErrors<T>;

    for (const name in fields) {
      errors[name] = validateField(name, fields[name].value);
    }

    return errors;
  }, [fields, validateField]);

  // Get current form values
  const values = useMemo((): FormValues<T> => {
    const formValues = {} as FormValues<T>;
    for (const name in fields) {
      formValues[name] = fields[name].value;
    }
    return formValues;
  }, [fields]);

  // Get current form errors
  const errors = useMemo((): FormErrors<T> => {
    const formErrors = {} as FormErrors<T>;
    for (const name in fields) {
      formErrors[name] = fields[name].error;
    }
    return formErrors;
  }, [fields]);

  // Check if form is valid
  const isValid = useMemo(() => {
    return Object.values(errors).every(error => error === null);
  }, [errors]);

  // Check if form is dirty
  const isDirty = useMemo(() => {
    return Object.values(fields).some(field => field.dirty);
  }, [fields]);

  // Check if form has been touched
  const isTouched = useMemo(() => {
    return Object.values(fields).some(field => field.touched);
  }, [fields]);

  // Set field value
  const setFieldValue = useCallback((name: keyof T, value: T[keyof T]) => {
    setFields(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        value,
        dirty: value !== initialValues[name],
        error: validateOnChange ? validateField(name, value) : prev[name].error,
      },
    }));
  }, [initialValues, validateOnChange, validateField]);

  // Set field error
  const setFieldError = useCallback((name: keyof T, error: string | null) => {
    setFields(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        error,
      },
    }));
  }, []);

  // Touch field
  const touchField = useCallback((name: keyof T) => {
    setFields(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        touched: true,
        error: validateOnBlur ? validateField(name, prev[name].value) : prev[name].error,
      },
    }));
  }, [validateOnBlur, validateField]);

  // Reset form
  const reset = useCallback((newValues?: Partial<T>) => {
    const resetValues = { ...initialValues, ...newValues };
    const resetFields = {} as FormFields<T>;

    for (const key in resetValues) {
      resetFields[key] = {
        value: resetValues[key],
        error: null,
        touched: false,
        dirty: false,
      };
    }

    setFields(resetFields);
    setIsSubmitting(false);
    setSubmitCount(0);
  }, [initialValues]);

  // Submit form
  const handleSubmit = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();

    setSubmitCount(prev => prev + 1);

    // Validate all fields
    const validationErrors = validateForm();

    // Update all fields with validation results
    setFields(prev => {
      const updated = { ...prev };
      for (const name in validationErrors) {
        updated[name] = {
          ...updated[name],
          error: validationErrors[name],
          touched: true,
        };
      }
      return updated;
    });

    // Check if form is valid
    const hasErrors = Object.values(validationErrors).some(error => error !== null);
    if (hasErrors) return;

    if (!onSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [validateForm, onSubmit, values]);

  // Helper function to get field props for input components
  const getFieldProps = useCallback((name: keyof T) => ({
    name: name as string,
    value: fields[name].value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFieldValue(name, event.target.value as T[keyof T]);
    },
    onBlur: () => touchField(name),
  }), [fields, setFieldValue, touchField]);

  return {
    // Form state
    values,
    errors,
    fields,
    isValid,
    isDirty,
    isTouched,
    isSubmitting,
    submitCount,

    // Actions
    setFieldValue,
    setFieldError,
    touchField,
    reset,
    handleSubmit,
    validateForm,

    // Helpers
    getFieldProps,
  };
}

// Field array hook for dynamic lists
export function useFieldArray<T>(initialItems: T[] = []) {
  const [items, setItems] = useState<T[]>(initialItems);

  const append = useCallback((item: T) => {
    setItems(prev => [...prev, item]);
  }, []);

  const prepend = useCallback((item: T) => {
    setItems(prev => [item, ...prev]);
  }, []);

  const insert = useCallback((index: number, item: T) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems.splice(index, 0, item);
      return newItems;
    });
  }, []);

  const remove = useCallback((index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const swap = useCallback((indexA: number, indexB: number) => {
    setItems(prev => {
      const newItems = [...prev];
      const itemA = newItems[indexA];
      const itemB = newItems[indexB];
      if (itemA !== undefined && itemB !== undefined) {
        newItems[indexA] = itemB;
        newItems[indexB] = itemA;
      }
      return newItems;
    });
  }, []);

  const move = useCallback((from: number, to: number) => {
    setItems(prev => {
      const newItems = [...prev];
      const item = newItems.splice(from, 1)[0];
      if (item !== undefined) {
        newItems.splice(to, 0, item);
      }
      return newItems;
    });
  }, []);

  const update = useCallback((index: number, item: T) => {
    setItems(prev => prev.map((current, i) => i === index ? item : current));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  return {
    items,
    append,
    prepend,
    insert,
    remove,
    swap,
    move,
    update,
    clear,
  };
}

// Auto-save hook for forms
export function useAutoSave<T>(
  values: T,
  saveFunction: (values: T) => Promise<void>,
  delay: number = 2000
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await saveFunction(values);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [values, saveFunction, delay]);

  return { isSaving, lastSaved };
}

// Form step hook for multi-step forms
export function useFormSteps(totalSteps: number) {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1));
  }, [totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(0, Math.min(step, totalSteps - 1)));
  }, [totalSteps]);

  const reset = useCallback(() => {
    setCurrentStep(0);
  }, []);

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return {
    currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    progress,
    nextStep,
    prevStep,
    goToStep,
    reset,
  };
}

// Common validators
export const validators = {
  required: (message = 'This field is required') => (value: any) => {
    if (value === null || value === undefined || value === '') {
      return message;
    }
    return null;
  },

  minLength: (min: number, message?: string) => (value: string) => {
    if (value && value.length < min) {
      return message || `Must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (max: number, message?: string) => (value: string) => {
    if (value && value.length > max) {
      return message || `Must be no more than ${max} characters`;
    }
    return null;
  },

  email: (message = 'Must be a valid email') => (value: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      return message;
    }
    return null;
  },

  url: (message = 'Must be a valid URL') => (value: string) => {
    try {
      if (value) new URL(value);
      return null;
    } catch {
      return message;
    }
  },

  number: (message = 'Must be a number') => (value: string) => {
    if (value && isNaN(Number(value))) {
      return message;
    }
    return null;
  },

  min: (min: number, message?: string) => (value: number) => {
    if (value < min) {
      return message || `Must be at least ${min}`;
    }
    return null;
  },

  max: (max: number, message?: string) => (value: number) => {
    if (value > max) {
      return message || `Must be no more than ${max}`;
    }
    return null;
  },

  pattern: (regex: RegExp, message = 'Invalid format') => (value: string) => {
    if (value && !regex.test(value)) {
      return message;
    }
    return null;
  },
};