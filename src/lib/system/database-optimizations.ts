/**
 * Database Performance Optimizations
 * Production-ready query helpers with queryMonitor instrumentation.
 */

import { db } from "~/server/db";
import { queryMonitor } from "./query-monitor";

export interface OptimizedQueryOptions {
  cache?: boolean;
  timeout?: number;
  retries?: number;
  batch?: boolean;
  include?: {
    user?: boolean;
    government?: boolean;
    embassies?: boolean;
  };
}

/**
 * Optimized country queries with performance monitoring
 */
export class OptimizedCountryQueries {
  /**
   * Get country by ID with optional relations and performance telemetry
   */
  static async getCountryById(id: string, options: OptimizedQueryOptions = {}): Promise<any> {
    const startTime = performance.now();

    try {
      const country = await db.country.findUnique({
        where: { id },
        include: {
          ...(options.include?.user && {
            user: { select: { id: true, clerkUserId: true, membershipTier: true, isActive: true } },
          }),
          ...(options.include?.government && {
            governmentStructure: {
              select: { id: true, governmentName: true, governmentType: true, totalBudget: true },
            },
          }),
          ...(options.include?.embassies && {
            embassiesHosting: {
              select: { id: true, name: true, level: true, status: true },
              take: 10,
            },
          }),
          _count: {
            select: { storytellerEffects: true, embassiesHosting: true, embassiesGuest: true },
          },
        },
      });

      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountryById",
        duration,
        success: true,
        dataSize: country ? JSON.stringify(country).length : 0,
        timestamp: Date.now(),
      });

      return country;
    } catch (error) {
      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountryById",
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Get multiple countries with batching and performance telemetry
   */
  static async getCountriesByIds(
    ids: string[],
    // oxlint-disable-next-line typescript/no-unused-vars
    options: OptimizedQueryOptions = {}
  ): Promise<any[]> {
    const startTime = performance.now();

    try {
      const countries = await db.country.findMany({
        where: { id: { in: ids } },
        include: {
          _count: {
            select: { storytellerEffects: true, embassiesHosting: true, embassiesGuest: true },
          },
        },
      });

      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountriesByIds",
        duration,
        success: true,
        dataSize: JSON.stringify(countries).length,
        timestamp: Date.now(),
      });

      return countries;
    } catch (error) {
      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountriesByIds",
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
      throw error;
    }
  }
}
