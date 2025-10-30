#!/usr/bin/env node

/**
 * Memory Monitor
 * Monitors memory usage and triggers GC when needed
 */

import { performance } from "perf_hooks";

class MemoryMonitor {
  constructor() {
    this.threshold = 0.8; // 80% memory usage
    this.interval = 30000; // 30 seconds
    this.start();
  }

  start() {
    setInterval(() => {
      this.checkMemory();
    }, this.interval);
  }

  checkMemory() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = heapUsedMB / heapTotalMB;

    console.log(
      `[MemoryMonitor] Heap: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${(usagePercent * 100).toFixed(1)}%)`
    );

    if (usagePercent > this.threshold) {
      console.warn(
        `[MemoryMonitor] High memory usage detected: ${(usagePercent * 100).toFixed(1)}%`
      );

      if (global.gc) {
        const startTime = performance.now();
        global.gc();
        const duration = performance.now() - startTime;
        console.log(`[MemoryMonitor] Garbage collection triggered (${duration.toFixed(2)}ms)`);
      } else {
        console.warn("[MemoryMonitor] Garbage collection not available");
      }
    }
  }
}

// Start monitoring
new MemoryMonitor();

console.log("[MemoryMonitor] Started memory monitoring...");
