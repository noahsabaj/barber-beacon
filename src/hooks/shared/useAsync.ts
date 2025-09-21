'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Debounced callback hook
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;

  return debouncedCallback;
}

// Throttle hook
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

// Throttled callback hook
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastRan = useRef(Date.now());

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRan.current >= limit) {
      callbackRef.current(...args);
      lastRan.current = Date.now();
    } else if (!timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
        lastRan.current = Date.now();
        timeoutRef.current = undefined;
      }, limit - (Date.now() - lastRan.current));
    }
  }, [limit]) as T;

  return throttledCallback;
}

// Async operation hook
export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  immediate: boolean = true
): AsyncState<T> & {
  execute: () => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const execute = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      isSuccess: false,
      isError: false,
    }));

    try {
      const data = await asyncFunction();
      setState({
        data,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      });
    } catch (error) {
      setState({
        data: null,
        error: error as Error,
        isLoading: false,
        isSuccess: false,
        isError: true,
      });
    }
  }, [asyncFunction]);

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { ...state, execute, reset };
}

// Interval hook
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }

    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
    return () => {}; // No cleanup needed when delay is null
  }, [delay]);
}

// Timeout hook
export function useTimeout(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }

    if (delay !== null) {
      const id = setTimeout(tick, delay);
      return () => clearTimeout(id);
    }
    return () => {}; // No cleanup needed when delay is null
  }, [delay]);
}

// Retry hook
export function useRetry<T>(
  asyncFunction: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
) {
  const [state, setState] = useState<AsyncState<T> & { retryCount: number }>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
    retryCount: 0,
  });

  const execute = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      isSuccess: false,
      isError: false,
    }));

    let retryCount = 0;

    const attemptExecution = async (): Promise<void> => {
      try {
        const data = await asyncFunction();
        setState({
          data,
          error: null,
          isLoading: false,
          isSuccess: true,
          isError: false,
          retryCount,
        });
      } catch (error) {
        retryCount++;

        if (retryCount <= maxRetries) {
          setState(prev => ({
            ...prev,
            retryCount,
          }));

          setTimeout(attemptExecution, retryDelay);
        } else {
          setState({
            data: null,
            error: error as Error,
            isLoading: false,
            isSuccess: false,
            isError: true,
            retryCount,
          });
        }
      }
    };

    await attemptExecution();
  }, [asyncFunction, maxRetries, retryDelay]);

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
      retryCount: 0,
    });
  }, []);

  return { ...state, execute, reset };
}

// Promise race hook
export function usePromiseRace<T>(
  promises: (() => Promise<T>)[],
  immediate: boolean = true
): AsyncState<T> & {
  execute: () => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    error: null,
    isLoading: false,
    isSuccess: false,
    isError: false,
  });

  const execute = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      isSuccess: false,
      isError: false,
    }));

    try {
      const data = await Promise.race(promises.map(p => p()));
      setState({
        data,
        error: null,
        isLoading: false,
        isSuccess: true,
        isError: false,
      });
    } catch (error) {
      setState({
        data: null,
        error: error as Error,
        isLoading: false,
        isSuccess: false,
        isError: true,
      });
    }
  }, [promises]);

  const reset = useCallback(() => {
    setState({
      data: null,
      error: null,
      isLoading: false,
      isSuccess: false,
      isError: false,
    });
  }, []);

  useEffect(() => {
    if (immediate && promises.length > 0) {
      execute();
    }
  }, [execute, immediate, promises.length]);

  return { ...state, execute, reset };
}

// Async queue hook
export function useAsyncQueue<T>() {
  const [queue, setQueue] = useState<Array<() => Promise<T>>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<T[]>([]);
  const [errors, setErrors] = useState<Error[]>([]);

  const addToQueue = useCallback((asyncFunction: () => Promise<T>) => {
    setQueue(prev => [...prev, asyncFunction]);
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessing || queue.length === 0) return;

    setIsProcessing(true);
    setResults([]);
    setErrors([]);

    for (const asyncFunction of queue) {
      try {
        const result = await asyncFunction();
        setResults(prev => [...prev, result]);
      } catch (error) {
        setErrors(prev => [...prev, error as Error]);
      }
    }

    setQueue([]);
    setIsProcessing(false);
  }, [queue, isProcessing]);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  return {
    queue,
    isProcessing,
    results,
    errors,
    addToQueue,
    processQueue,
    clearQueue,
  };
}