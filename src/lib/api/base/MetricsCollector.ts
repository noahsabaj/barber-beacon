export interface MetricEvent {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ErrorMetric {
  operation: string;
  error: string;
  stack?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface BusinessMetric {
  event: string;
  value: number;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class MetricsCollector {
  private metrics: MetricEvent[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private businessMetrics: BusinessMetric[] = [];
  private maxBufferSize: number;

  constructor(maxBufferSize = 10000) {
    this.maxBufferSize = maxBufferSize;
  }

  // Record a generic metric
  record(name: string, value: number, unit = 'count', tags?: Record<string, string>, metadata?: Record<string, any>): void {
    const metric: MetricEvent = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      ...(tags !== undefined && { tags }),
      ...(metadata !== undefined && { metadata }),
    };

    this.metrics.push(metric);
    this.enforceBufferLimit(this.metrics);
  }

  // Record performance metrics
  recordPerformance(operation: string, duration: number, success: boolean, metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      success,
      timestamp: Date.now(),
      ...(metadata !== undefined && { metadata }),
    };

    this.performanceMetrics.push(metric);
    this.enforceBufferLimit(this.performanceMetrics);
  }

  // Record error metrics
  recordError(operation: string, error: Error | string, metadata?: Record<string, any>): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;

    const metric: ErrorMetric = {
      operation,
      error: errorMessage,
      ...(stack !== undefined && { stack }),
      timestamp: Date.now(),
      ...(metadata !== undefined && { metadata }),
    };

    this.errorMetrics.push(metric);
    this.enforceBufferLimit(this.errorMetrics);
  }

  // Record business metrics
  recordBusiness(event: string, value: number, userId?: string, sessionId?: string, metadata?: Record<string, any>): void {
    const metric: BusinessMetric = {
      event,
      value,
      ...(userId !== undefined && { userId }),
      ...(sessionId !== undefined && { sessionId }),
      timestamp: Date.now(),
      ...(metadata !== undefined && { metadata }),
    };

    this.businessMetrics.push(metric);
    this.enforceBufferLimit(this.businessMetrics);
  }

  // Increment a counter
  increment(name: string, tags?: Record<string, string>, metadata?: Record<string, any>): void {
    this.record(name, 1, 'count', tags, metadata);
  }

  // Record a timing metric
  timing(name: string, duration: number, tags?: Record<string, string>, metadata?: Record<string, any>): void {
    this.record(name, duration, 'ms', tags, metadata);
  }

  // Record a gauge metric
  gauge(name: string, value: number, tags?: Record<string, string>, metadata?: Record<string, any>): void {
    this.record(name, value, 'gauge', tags, metadata);
  }

  // Performance timing decorator
  time<T extends any[], R>(
    operation: string,
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const start = Date.now();
      let success = false;
      let error: Error | undefined;

      try {
        const result = await fn(...args);
        success = true;
        return result;
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
        throw err;
      } finally {
        const duration = Date.now() - start;
        this.recordPerformance(operation, duration, success);

        if (error) {
          this.recordError(operation, error);
        }
      }
    };
  }

  // Get metrics summary
  getSummary(): {
    totalEvents: number;
    performanceMetrics: number;
    errorMetrics: number;
    businessMetrics: number;
    averageResponseTime: number;
    errorRate: number;
  } {
    const totalPerformanceMetrics = this.performanceMetrics.length;
    const successfulRequests = this.performanceMetrics.filter(m => m.success).length;
    const averageResponseTime = totalPerformanceMetrics > 0
      ? this.performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / totalPerformanceMetrics
      : 0;

    const errorRate = totalPerformanceMetrics > 0
      ? (totalPerformanceMetrics - successfulRequests) / totalPerformanceMetrics
      : 0;

    return {
      totalEvents: this.metrics.length,
      performanceMetrics: this.performanceMetrics.length,
      errorMetrics: this.errorMetrics.length,
      businessMetrics: this.businessMetrics.length,
      averageResponseTime,
      errorRate,
    };
  }

  // Get metrics by name
  getMetricsByName(name: string): MetricEvent[] {
    return this.metrics.filter(m => m.name === name);
  }

  // Get performance metrics by operation
  getPerformanceByOperation(operation: string): PerformanceMetric[] {
    return this.performanceMetrics.filter(m => m.operation === operation);
  }

  // Get error metrics by operation
  getErrorsByOperation(operation: string): ErrorMetric[] {
    return this.errorMetrics.filter(m => m.operation === operation);
  }

  // Export metrics for external systems
  exportMetrics(): {
    metrics: MetricEvent[];
    performance: PerformanceMetric[];
    errors: ErrorMetric[];
    business: BusinessMetric[];
  } {
    return {
      metrics: [...this.metrics],
      performance: [...this.performanceMetrics],
      errors: [...this.errorMetrics],
      business: [...this.businessMetrics],
    };
  }

  // Clear all metrics
  clear(): void {
    this.metrics = [];
    this.performanceMetrics = [];
    this.errorMetrics = [];
    this.businessMetrics = [];
  }

  // Clear old metrics (older than specified time)
  clearOldMetrics(olderThan: number): void {
    const cutoff = Date.now() - olderThan;

    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoff);
    this.errorMetrics = this.errorMetrics.filter(m => m.timestamp > cutoff);
    this.businessMetrics = this.businessMetrics.filter(m => m.timestamp > cutoff);
  }

  private enforceBufferLimit<T>(buffer: T[]): void {
    if (buffer.length > this.maxBufferSize) {
      buffer.splice(0, buffer.length - this.maxBufferSize);
    }
  }

  // Additional instance methods needed by the application
  recordUserAction(operation: string, userId: string, metadata?: Record<string, any>): void {
    this.recordBusiness(
      `user_action_${operation}`,
      1,
      userId,
      undefined,
      metadata
    );
  }

  recordBatchOperation(operation: string, itemCount: number, duration: number, success: boolean): void {
    this.recordPerformance(
      `batch_${operation}`,
      duration,
      success,
      { itemCount }
    );

    this.record(
      'batch_operation',
      itemCount,
      'count',
      {
        operation,
        success: String(success),
      }
    );
  }

  recordLatency(operation: string, duration: number, metadata?: Record<string, any>): void {
    this.timing(
      `latency_${operation}`,
      duration,
      undefined,
      metadata
    );
  }

  recordCacheHit(operation: string): void {
    this.increment(
      'cache_hit',
      { operation }
    );
  }

  recordCacheMiss(operation: string): void {
    this.increment(
      'cache_miss',
      { operation }
    );
  }

  recordDatabaseOperation(operation: string, duration: number, success: boolean): void {
    this.recordPerformance(
      `db.${operation}`,
      duration,
      success,
      { operation }
    );
  }
}

// Global metrics collector instance
export const globalMetrics = new MetricsCollector(50000);

// Decorator for automatic performance tracking
export function trackPerformance(operation: string) {
  return function <T extends any[], R>(
    _target: any,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    if (!descriptor.value) return;

    const originalMethod = descriptor.value;

    descriptor.value = globalMetrics.time(operation, originalMethod);

    return descriptor;
  };
}

// HTTP request metrics helpers
export function recordHttpRequest(method: string, path: string, statusCode: number, duration: number): void {
  globalMetrics.record(
    'http_request',
    1,
    'count',
    {
      method,
      path,
      status_code: String(statusCode),
      status_class: `${Math.floor(statusCode / 100)}xx`,
    }
  );

  globalMetrics.timing(
    'http_request_duration',
    duration,
    {
      method,
      path,
      status_code: String(statusCode),
    }
  );
}

// Database query metrics helpers
export function recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean): void {
  globalMetrics.recordPerformance(
    `db_${operation}`,
    duration,
    success,
    { table }
  );

  globalMetrics.record(
    'database_query',
    1,
    'count',
    {
      operation,
      table,
      success: String(success),
    }
  );
}

// Additional missing methods needed by the application
export function recordUserAction(operation: string, userId: string, metadata?: Record<string, any>): void {
  globalMetrics.recordBusiness(
    `user_action_${operation}`,
    1,
    userId,
    undefined,
    metadata
  );
}

export function recordBatchOperation(operation: string, itemCount: number, duration: number, success: boolean): void {
  globalMetrics.recordPerformance(
    `batch_${operation}`,
    duration,
    success,
    { itemCount }
  );

  globalMetrics.record(
    'batch_operation',
    itemCount,
    'count',
    {
      operation,
      success: String(success),
    }
  );
}

export function recordLatency(operation: string, duration: number, metadata?: Record<string, any>): void {
  globalMetrics.timing(
    `latency_${operation}`,
    duration,
    undefined,
    metadata
  );
}

export function recordCacheHit(operation: string): void {
  globalMetrics.increment(
    'cache_hit',
    { operation }
  );
}