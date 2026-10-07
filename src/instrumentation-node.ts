/**
 * Node.js half of the instrumentation hook (see `src/instrumentation.ts`). Kept in its own module
 * so the Edge bundle never sees `./server/db` and its Node-only imports.
 */

export async function registerNode() {
  syncBaselineAchievements();

  if (process.env.NODE_ENV === "production") {
    console.log("[Instrumentation] Initializing production optimizations...");

    try {
      const { ProductionStartup } = await import("~/lib/system/server");

      // Initialize production optimizations (memory monitoring, slow query analysis)
      await ProductionStartup.initialize();

      // Warm up critical caches on startup
      // This pre-loads frequently accessed data to reduce cold-start latency
      try {
        await ProductionStartup.warmupCaches();
      } catch (cacheError) {
        // Non-fatal: continue even if cache warm-up fails
        console.warn("[Instrumentation] Cache warm-up failed (non-fatal):", cacheError);
      }

      // Warm up geo layer cache (pre-load all 7 map layers into memory)
      try {
        const { db } = await import("./server/db");
        const { warmGeoCache } = await import("./server/api/routers/geo/core");
        await warmGeoCache(db);
      } catch (geoError) {
        console.warn("[Instrumentation] Geo cache warm-up failed (non-fatal):", geoError);
      }

      const { registerNodeProcessErrorHandlers } =
        await import("~/lib/system/node-process-error-handlers");
      registerNodeProcessErrorHandlers();

      console.log("[Instrumentation] Production optimizations initialized successfully");

      // Signal PM2 that we are ready (for zero-downtime cluster reloads)
      const p = process as any;
      if (p.send) {
        p.send("ready");
        console.log("[Instrumentation] Signal sent to PM2: ready");
      }
    } catch (error) {
      // Log but don't crash the server
      console.error("[Instrumentation] Failed to initialize optimizations:", error);
    }
  } else {
    console.log("[Instrumentation] Development mode - initializing memory monitoring...");

    try {
      const { ProductionStartup } = await import("~/lib/system/server");

      // Initialize memory monitoring (cache clearing, GC triggers) in dev mode
      // This enables proactive cache clearing at 65% threshold before Next.js restarts at 80%
      await ProductionStartup.initialize();

      console.log("[Instrumentation] Dev memory monitoring initialized");
    } catch (error) {
      console.warn("[Instrumentation] Dev memory monitoring setup failed (non-fatal):", error);
    }

    // Warm critical geo layers in dev so the first map load is instant.
    // Altitudes (4068 features) takes ~2s to query+compress — do it at startup, not on first request.
    try {
      const { db } = await import("./server/db");
      const { warmGeoCacheDev } = await import("./server/api/routers/geo/core");
      // Fire-and-forget — don't block server startup
      warmGeoCacheDev(db).catch((err: unknown) =>
        console.warn("[Instrumentation] Dev geo cache warm-up failed (non-fatal):", err)
      );
    } catch (error) {
      console.warn("[Instrumentation] Dev geo cache import failed (non-fatal):", error);
    }
  }
}

/**
 * Upsert the built-in achievement definitions once per web-server start, in the
 * background. Lives here rather than in server/db.ts so scripts, cron runners and
 * tests that import the database client don't trigger it.
 */
function syncBaselineAchievements() {
  if (process.env.DATABASE_READONLY === "true" || process.env.NODE_ENV === "test") return;
  void Promise.all([import("./server/db"), import("~/lib/achievements/sync")])
    .then(([{ db }, { syncAchievements }]) => syncAchievements(db))
    .catch((err: unknown) =>
      console.error("[Instrumentation] Baseline achievements sync failed:", err)
    );
}
