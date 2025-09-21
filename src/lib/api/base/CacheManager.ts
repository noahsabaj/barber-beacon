export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  strategy?: 'lru' | 'fifo' | 'ttl';
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  expiry?: number;
  createdAt: number;
  accessCount: number;
  lastAccessed: number;
}

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTtl: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTtl = options.ttl || 5 * 60 * 1000; // 5 minutes
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiry = ttl || this.defaultTtl;

    const entry: CacheEntry<T> = {
      key,
      value,
      expiry: now + expiry,
      createdAt: now,
      accessCount: 0,
      lastAccessed: now,
    };

    // If cache is full, evict least recently used
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // Convert pattern to regex (simple wildcard support)
    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Replace * with .*
    const regex = new RegExp(`^${regexPattern}$`);

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiry && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  size(): number {
    // Clean expired entries first
    this.cleanExpired();
    return this.cache.size;
  }

  keys(): string[] {
    this.cleanExpired();
    return Array.from(this.cache.keys());
  }

  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    this.cleanExpired();

    let totalAccess = 0;
    let hits = 0;

    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
      if (entry.accessCount > 0) hits++;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalAccess > 0 ? hits / totalAccess : 0,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  private cleanExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry && now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    let size = 0;

    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry).length * 2; // Unicode characters are 2 bytes
    }

    return size;
  }
}

// Global cache instance
export const globalCache = new CacheManager({
  maxSize: 10000,
  ttl: 15 * 60 * 1000, // 15 minutes
});

// Cache decorators and utilities
export function withCache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  ttl?: number
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args);

    const cached = globalCache.get<R>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    globalCache.set(key, result, ttl);

    return result;
  };
}

export function cacheKey(...parts: (string | number | boolean)[]): string {
  return parts.map(part => String(part)).join(':');
}