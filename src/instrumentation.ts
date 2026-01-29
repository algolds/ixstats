/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically loaded by Next.js when experimental.instrumentationHook is enabled.
 * It runs once when the server starts, making it ideal for:
 * - Cache warm-up
 * - Database connection initialization
 * - Memory monitoring setup
 * - Performance metric collection
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run optimizations in production
  if (process.env.NODE_ENV === "production") {
    console.log("[Instrumentation] Initializing production optimizations...");

    try {
      // Dynamically import to avoid bundling issues
      const { ProductionStartup, MemoryOptimizer } = await import(
        "./lib/production-optimizations"
      );

      // Initialize production optimizations (memory monitoring, slow query analysis)
      await ProductionStartup.initialize();

      // Set up periodic memory monitoring (every 30 seconds)
      setInterval(() => {
        MemoryOptimizer.monitorMemoryUsage();
      }, 30000);

      // Warm up critical caches on startup
      // This pre-loads frequently accessed data to reduce cold-start latency
      try {
        await ProductionStartup.warmupCaches();
      } catch (cacheError) {
        // Non-fatal: continue even if cache warm-up fails
        console.warn(
          "[Instrumentation] Cache warm-up failed (non-fatal):",
          cacheError
        );
      }

      console.log("[Instrumentation] Production optimizations initialized successfully");
    } catch (error) {
      // Log but don't crash the server
      console.error("[Instrumentation] Failed to initialize optimizations:", error);
    }
  } else {
    console.log("[Instrumentation] Development mode - skipping production optimizations");
  }
}
