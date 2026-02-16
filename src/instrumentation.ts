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
 * IMPORTANT: register() runs in BOTH Node.js and Edge runtimes.
 * Guard Node.js-only imports behind process.env.NEXT_RUNTIME === 'nodejs'
 * so Turbopack excludes them from the Edge bundle (avoids process.memoryUsage warnings).
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in Node.js runtime — skip Edge runtime entirely.
  // Turbopack uses this check to tree-shake Node.js imports from the Edge bundle.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

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
    console.log("[Instrumentation] Development mode - initializing memory monitoring...");

    try {
      const { ProductionStartup } = await import("./lib/production-optimizations");

      // Initialize memory monitoring (cache clearing, GC triggers) in dev mode
      // This enables proactive cache clearing at 65% threshold before Next.js restarts at 80%
      await ProductionStartup.initialize();

      console.log("[Instrumentation] Dev memory monitoring initialized");
    } catch (error) {
      console.warn("[Instrumentation] Dev memory monitoring setup failed (non-fatal):", error);
    }
  }
}
