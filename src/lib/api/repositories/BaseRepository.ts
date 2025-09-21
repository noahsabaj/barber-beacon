/**
 * Base Repository Pattern Implementation
 *
 * Provides a generic foundation for all data access operations with:
 * - Standard CRUD operations (Create, Read, Update, Delete)
 * - Advanced querying with filtering, sorting, and pagination
 * - Transaction support for complex operations
 * - Caching layer integration
 * - Type-safe operations with TypeScript generics
 * - Error handling and logging
 * - Performance monitoring and metrics
 */

import { PrismaClient } from '@prisma/client'
import {
  InternalServerError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ErrorHandler
} from '../base/ApiError'

export interface PaginationOptions {
  page: number
  limit: number
  offset?: number
}

export interface PaginationResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
    offset: number
  }
}

export interface QueryOptions<T = any> {
  where?: T
  select?: T
  include?: T
  orderBy?: T | T[]
  pagination?: PaginationOptions
  distinct?: T
  cursor?: T
  take?: number
  skip?: number
}

export interface CacheOptions {
  key?: string
  ttl?: number // Time to live in seconds
  enabled?: boolean
  tags?: string[] // For cache invalidation
}

export interface TransactionContext {
  prisma: PrismaClient
  id: string
}

export interface RepositoryMetrics {
  operation: string
  duration: number
  success: boolean
  cacheHit?: boolean
  recordCount?: number
}

/**
 * Base Repository Class
 *
 * Generic repository pattern implementation that provides standardized
 * data access operations for all domain entities.
 */
export abstract class BaseRepository<
  TModel,
  TCreateInput,
  TUpdateInput,
  TWhereInput = any,
  TWhereUniqueInput = any,
  TOrderByInput = any,
  TSelectInput = any,
  TIncludeInput = any
> {
  protected readonly prisma: PrismaClient
  protected readonly modelName: string
  protected readonly cacheEnabled: boolean
  protected readonly defaultCacheTTL: number

  constructor(
    prisma: PrismaClient,
    modelName: string,
    options: {
      cacheEnabled?: boolean
      defaultCacheTTL?: number
    } = {}
  ) {
    this.prisma = prisma
    this.modelName = modelName
    this.cacheEnabled = options.cacheEnabled ?? true
    this.defaultCacheTTL = options.defaultCacheTTL ?? 300 // 5 minutes
  }

  /**
   * Get the Prisma model delegate for the entity
   */
  protected abstract getModel(): any

  /**
   * Get cache key for specific operation and identifier
   */
  protected getCacheKey(operation: string, identifier?: string): string {
    const parts = [this.modelName, operation]
    if (identifier) parts.push(identifier)
    return parts.join(':')
  }

  /**
   * Invalidate cache for specific patterns
   */
  protected async invalidateCache(patterns: string[]): Promise<void> {
    // TODO: Implement cache invalidation logic
    // This would integrate with Redis or in-memory cache
    console.log(`Invalidating cache for patterns: ${patterns.join(', ')}`)
  }

  /**
   * Record metrics for operations
   */
  protected recordMetrics(metrics: RepositoryMetrics): void {
    // TODO: Implement metrics recording
    console.log(`Repository Metrics: ${JSON.stringify(metrics)}`)
  }

  /**
   * Handle database errors and convert to appropriate API errors
   */
  protected handleDatabaseError(error: any, operation: string): never {
    console.error(`Database error in ${this.modelName}.${operation}:`, error)

    if (error.code === 'P2002') {
      throw new ConflictError(`Unique constraint violation in ${this.modelName}`)
    }

    if (error.code === 'P2025') {
      throw new NotFoundError(`${this.modelName} not found`)
    }

    if (error.code === 'P2003') {
      throw new ValidationError(`Foreign key constraint failed in ${this.modelName}`)
    }

    throw new InternalServerError(`Database operation failed: ${operation}`, {
      cause: error,
      metadata: { modelName: this.modelName, operation }
    })
  }

  // ===== CRUD OPERATIONS =====

  /**
   * Create a new record
   */
  async create(
    data: TCreateInput,
    options: {
      select?: TSelectInput
      include?: TIncludeInput
      cache?: CacheOptions
    } = {}
  ): Promise<TModel> {
    const startTime = Date.now()

    try {
      const model = this.getModel()
      const result = await model.create({
        data,
        select: options.select,
        include: options.include
      })

      // Invalidate relevant cache entries
      if (this.cacheEnabled) {
        await this.invalidateCache([
          this.getCacheKey('list'),
          this.getCacheKey('count')
        ])
      }

      this.recordMetrics({
        operation: 'create',
        duration: Date.now() - startTime,
        success: true,
        recordCount: 1
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'create',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'create')
    }
  }

  /**
   * Find a single record by unique identifier
   */
  async findUnique(
    where: TWhereUniqueInput,
    options: {
      select?: TSelectInput
      include?: TIncludeInput
      cache?: CacheOptions
    } = {}
  ): Promise<TModel | null> {
    const startTime = Date.now()
    // const cacheKey = this.getCacheKey('findUnique', JSON.stringify(where))

    try {
      // Check cache first
      if (this.cacheEnabled && options.cache?.enabled !== false) {
        // TODO: Implement cache retrieval
        // const cached = await getFromCache(cacheKey)
        // if (cached) return cached
      }

      const model = this.getModel()
      const result = await model.findUnique({
        where,
        select: options.select,
        include: options.include
      })

      // Cache the result
      if (this.cacheEnabled && result && options.cache?.enabled !== false) {
        // TODO: Implement caching
        // await setCache(cacheKey, result, options.cache?.ttl || this.defaultCacheTTL)
      }

      this.recordMetrics({
        operation: 'findUnique',
        duration: Date.now() - startTime,
        success: true,
        recordCount: result ? 1 : 0,
        cacheHit: false // TODO: Track actual cache hits
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'findUnique',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'findUnique')
    }
  }

  /**
   * Find a single record by unique identifier or throw if not found
   */
  async findUniqueOrThrow(
    where: TWhereUniqueInput,
    options: {
      select?: TSelectInput
      include?: TIncludeInput
      cache?: CacheOptions
    } = {}
  ): Promise<TModel> {
    const result = await this.findUnique(where, options)

    if (!result) {
      throw new NotFoundError(`${this.modelName} not found`)
    }

    return result
  }

  /**
   * Find first record matching criteria
   */
  async findFirst(
    options: {
      where?: TWhereInput
      select?: TSelectInput
      include?: TIncludeInput
      orderBy?: TOrderByInput | TOrderByInput[]
      cursor?: TWhereUniqueInput
      take?: number
      skip?: number
      cache?: CacheOptions
    } = {}
  ): Promise<TModel | null> {
    const startTime = Date.now()

    try {
      const model = this.getModel()
      const result = await model.findFirst({
        where: options.where,
        select: options.select,
        include: options.include,
        orderBy: options.orderBy,
        cursor: options.cursor,
        take: options.take,
        skip: options.skip
      })

      this.recordMetrics({
        operation: 'findFirst',
        duration: Date.now() - startTime,
        success: true,
        recordCount: result ? 1 : 0
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'findFirst',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'findFirst')
    }
  }

  /**
   * Find many records with pagination support
   */
  async findMany(
    options: {
      where?: TWhereInput
      select?: TSelectInput
      include?: TIncludeInput
      orderBy?: TOrderByInput | TOrderByInput[]
      cursor?: TWhereUniqueInput
      take?: number
      skip?: number
      distinct?: TSelectInput
      pagination?: PaginationOptions
      cache?: CacheOptions
    } = {}
  ): Promise<TModel[]> {
    const startTime = Date.now()

    try {
      const model = this.getModel()

      // Handle pagination
      let take = options.take
      let skip = options.skip

      if (options.pagination) {
        const { page, limit } = options.pagination
        take = limit
        skip = (page - 1) * limit
      }

      const result = await model.findMany({
        where: options.where,
        select: options.select,
        include: options.include,
        orderBy: options.orderBy,
        cursor: options.cursor,
        take,
        skip,
        distinct: options.distinct
      })

      this.recordMetrics({
        operation: 'findMany',
        duration: Date.now() - startTime,
        success: true,
        recordCount: result.length
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'findMany',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'findMany')
    }
  }

  /**
   * Find many records with pagination metadata
   */
  async findManyWithPagination(
    options: {
      where?: TWhereInput
      select?: TSelectInput
      include?: TIncludeInput
      orderBy?: TOrderByInput | TOrderByInput[]
      pagination: PaginationOptions
      cache?: CacheOptions
    }
  ): Promise<PaginationResult<TModel>> {
    const startTime = Date.now()

    try {
      const { pagination } = options
      const { page, limit } = pagination
      const offset = (page - 1) * limit

      // Execute count and data queries in parallel
      const [data, total] = await Promise.all([
        this.findMany({
          ...options,
          take: limit,
          skip: offset
        }),
        this.count({ ...(options.where !== undefined && { where: options.where }) })
      ])

      const totalPages = Math.ceil(total / limit)

      this.recordMetrics({
        operation: 'findManyWithPagination',
        duration: Date.now() - startTime,
        success: true,
        recordCount: data.length
      })

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          offset
        }
      }
    } catch (error) {
      this.recordMetrics({
        operation: 'findManyWithPagination',
        duration: Date.now() - startTime,
        success: false
      })

      throw ErrorHandler.toApiError(error)
    }
  }

  /**
   * Update a single record
   */
  async update(
    where: TWhereUniqueInput,
    data: TUpdateInput,
    options: {
      select?: TSelectInput
      include?: TIncludeInput
    } = {}
  ): Promise<TModel> {
    const startTime = Date.now()

    try {
      const model = this.getModel()
      const result = await model.update({
        where,
        data,
        select: options.select,
        include: options.include
      })

      // Invalidate cache
      if (this.cacheEnabled) {
        await this.invalidateCache([
          this.getCacheKey('findUnique', JSON.stringify(where)),
          this.getCacheKey('list'),
          this.getCacheKey('count')
        ])
      }

      this.recordMetrics({
        operation: 'update',
        duration: Date.now() - startTime,
        success: true,
        recordCount: 1
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'update',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'update')
    }
  }

  /**
   * Update many records
   */
  async updateMany(
    where: TWhereInput,
    data: TUpdateInput
  ): Promise<{ count: number }> {
    const startTime = Date.now()

    try {
      const model = this.getModel()
      const result = await model.updateMany({
        where,
        data
      })

      // Invalidate cache
      if (this.cacheEnabled) {
        await this.invalidateCache([
          this.getCacheKey('list'),
          this.getCacheKey('count')
        ])
      }

      this.recordMetrics({
        operation: 'updateMany',
        duration: Date.now() - startTime,
        success: true,
        recordCount: result.count
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'updateMany',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'updateMany')
    }
  }

  /**
   * Upsert a record (create or update)
   */
  async upsert(
    where: TWhereUniqueInput,
    create: TCreateInput,
    update: TUpdateInput,
    options: {
      select?: TSelectInput
      include?: TIncludeInput
    } = {}
  ): Promise<TModel> {
    const startTime = Date.now()

    try {
      const model = this.getModel()
      const result = await model.upsert({
        where,
        create,
        update,
        select: options.select,
        include: options.include
      })

      // Invalidate cache
      if (this.cacheEnabled) {
        await this.invalidateCache([
          this.getCacheKey('findUnique', JSON.stringify(where)),
          this.getCacheKey('list'),
          this.getCacheKey('count')
        ])
      }

      this.recordMetrics({
        operation: 'upsert',
        duration: Date.now() - startTime,
        success: true,
        recordCount: 1
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'upsert',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'upsert')
    }
  }

  /**
   * Delete a single record
   */
  async delete(
    where: TWhereUniqueInput,
    options: {
      select?: TSelectInput
      include?: TIncludeInput
    } = {}
  ): Promise<TModel> {
    const startTime = Date.now()

    try {
      const model = this.getModel()
      const result = await model.delete({
        where,
        select: options.select,
        include: options.include
      })

      // Invalidate cache
      if (this.cacheEnabled) {
        await this.invalidateCache([
          this.getCacheKey('findUnique', JSON.stringify(where)),
          this.getCacheKey('list'),
          this.getCacheKey('count')
        ])
      }

      this.recordMetrics({
        operation: 'delete',
        duration: Date.now() - startTime,
        success: true,
        recordCount: 1
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'delete',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'delete')
    }
  }

  /**
   * Delete many records
   */
  async deleteMany(where: TWhereInput): Promise<{ count: number }> {
    const startTime = Date.now()

    try {
      const model = this.getModel()
      const result = await model.deleteMany({ where })

      // Invalidate cache
      if (this.cacheEnabled) {
        await this.invalidateCache([
          this.getCacheKey('list'),
          this.getCacheKey('count')
        ])
      }

      this.recordMetrics({
        operation: 'deleteMany',
        duration: Date.now() - startTime,
        success: true,
        recordCount: result.count
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'deleteMany',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'deleteMany')
    }
  }

  /**
   * Count records matching criteria
   */
  async count(
    options: {
      where?: TWhereInput
      cursor?: TWhereUniqueInput
      take?: number
      skip?: number
      distinct?: TSelectInput
      cache?: CacheOptions
    } = {}
  ): Promise<number> {
    const startTime = Date.now()

    try {
      const model = this.getModel()
      const result = await model.count({
        where: options.where,
        cursor: options.cursor,
        take: options.take,
        skip: options.skip,
        distinct: options.distinct
      })

      this.recordMetrics({
        operation: 'count',
        duration: Date.now() - startTime,
        success: true
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'count',
        duration: Date.now() - startTime,
        success: false
      })

      this.handleDatabaseError(error, 'count')
    }
  }

  /**
   * Check if record exists
   */
  async exists(where: TWhereInput): Promise<boolean> {
    const count = await this.count({ where })
    return count > 0
  }

  // ===== TRANSACTION SUPPORT =====

  /**
   * Execute operations within a transaction
   */
  async withTransaction<T>(
    operations: (ctx: TransactionContext) => Promise<T>
  ): Promise<T> {
    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()

    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        const context: TransactionContext = {
          prisma: prisma as PrismaClient,
          id: transactionId
        }

        return await operations(context)
      })

      this.recordMetrics({
        operation: 'transaction',
        duration: Date.now() - startTime,
        success: true
      })

      return result
    } catch (error) {
      this.recordMetrics({
        operation: 'transaction',
        duration: Date.now() - startTime,
        success: false
      })

      throw ErrorHandler.toApiError(error)
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Validate data before operations
   */
  protected async validateData(_data: any, _operation: string): Promise<void> {
    // Override in derived classes for specific validation
  }

  /**
   * Transform data after retrieval
   */
  protected transformResult(result: any): any {
    // Override in derived classes for specific transformations
    return result
  }

  /**
   * Build complex where clauses
   */
  protected buildWhereClause(filters: Record<string, any>): any {
    const where: any = {}

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue

      if (typeof value === 'string' && value.includes('*')) {
        // Handle wildcard search
        where[key] = {
          contains: value.replace(/\*/g, ''),
          mode: 'insensitive'
        }
      } else if (Array.isArray(value)) {
        where[key] = { in: value }
      } else {
        where[key] = value
      }
    }

    return where
  }

  /**
   * Build order by clauses
   */
  protected buildOrderBy(
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc'
  ): any {
    if (!sortBy) return undefined

    return { [sortBy]: sortOrder }
  }
}