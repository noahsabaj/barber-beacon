'use client';

import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = T | ((val: T) => T);

interface UseLocalStorageOptions<T> {
  defaultValue?: T;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  onError?: (error: Error) => void;
}

export function useLocalStorage<T>(
  key: string,
  initialValue?: T,
  options: UseLocalStorageOptions<T> = {}
): [T | undefined, (value: SetValue<T>) => void, () => void] {
  const {
    defaultValue = initialValue,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    onError,
  } = options;

  // Get initial value from localStorage or use default
  const [storedValue, setStoredValue] = useState<T | undefined>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return deserialize(item);
    } catch (error) {
      onError?.(error as Error);
      return defaultValue;
    }
  });

  // Set value in localStorage and state
  const setValue = useCallback((value: SetValue<T>) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue as T) : value;

      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        if (valueToStore === undefined || valueToStore === null) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, serialize(valueToStore));
        }
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [key, serialize, storedValue, onError]);

  // Remove value from localStorage and reset state to default
  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [key, defaultValue, onError]);

  // Listen for changes in other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(deserialize(e.newValue));
        } catch (error) {
          onError?.(error as Error);
        }
      } else if (e.key === key && e.newValue === null) {
        setStoredValue(defaultValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, defaultValue, deserialize, onError]);

  return [storedValue, setValue, removeValue];
}

// Hook for session storage (similar to localStorage but for session only)
export function useSessionStorage<T>(
  key: string,
  initialValue?: T,
  options: UseLocalStorageOptions<T> = {}
): [T | undefined, (value: SetValue<T>) => void, () => void] {
  const {
    defaultValue = initialValue,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    onError,
  } = options;

  const [storedValue, setStoredValue] = useState<T | undefined>(() => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const item = window.sessionStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return deserialize(item);
    } catch (error) {
      onError?.(error as Error);
      return defaultValue;
    }
  });

  const setValue = useCallback((value: SetValue<T>) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue as T) : value;

      setStoredValue(valueToStore);

      if (typeof window !== 'undefined') {
        if (valueToStore === undefined || valueToStore === null) {
          window.sessionStorage.removeItem(key);
        } else {
          window.sessionStorage.setItem(key, serialize(valueToStore));
        }
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [key, serialize, storedValue, onError]);

  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key);
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [key, defaultValue, onError]);

  return [storedValue, setValue, removeValue];
}

// Specialized hooks for common storage patterns
export function usePreferences<T extends Record<string, any>>(defaultPreferences: T) {
  const [preferences, setPreferences, clearPreferences] = useLocalStorage(
    'user-preferences',
    defaultPreferences
  );

  const updatePreference = useCallback(<K extends keyof T>(
    key: K,
    value: T[K]
  ) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  }, [setPreferences]);

  const resetPreferences = useCallback(() => {
    setPreferences(defaultPreferences);
  }, [setPreferences, defaultPreferences]);

  return {
    preferences: preferences || defaultPreferences,
    updatePreference,
    resetPreferences,
    clearPreferences,
  };
}

export function useRecentItems<T>(key: string, maxItems: number = 10) {
  const [items, setItems] = useLocalStorage<T[]>(key, []);

  const addItem = useCallback((item: T) => {
    setItems(prev => {
      const filtered = (prev || []).filter(existingItem =>
        JSON.stringify(existingItem) !== JSON.stringify(item)
      );
      return [item, ...filtered].slice(0, maxItems);
    });
  }, [setItems, maxItems]);

  const removeItem = useCallback((item: T) => {
    setItems(prev =>
      (prev || []).filter(existingItem =>
        JSON.stringify(existingItem) !== JSON.stringify(item)
      )
    );
  }, [setItems]);

  const clearItems = useCallback(() => {
    setItems([]);
  }, [setItems]);

  return {
    items: items || [],
    addItem,
    removeItem,
    clearItems,
  };
}

export function useDraftData<T>(key: string) {
  const [draft, setDraft, clearDraft] = useLocalStorage<T>(key);

  const saveDraft = useCallback((data: T) => {
    setDraft(data);
  }, [setDraft]);

  const hasDraft = draft !== undefined && draft !== null;

  return {
    draft,
    saveDraft,
    clearDraft,
    hasDraft,
  };
}