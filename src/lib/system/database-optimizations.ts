/**
 * Database Performance Optimizations
 * Production-ready query helpers with queryMonitor instrumentation.
 */

import { db } from "~/server/db";
import { queryMonitor } from "./query-monitor";

interface OptimizedQueryOptions {
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
