/**
 * Production Middleware
 * Performance monitoring, rate limiting, and security headers
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ProductionMiddleware,
  PerformanceMonitor,
  MemoryOptimizer,
} from "~/lib/production-optimizations";

// Rate limiting store (in-memory for now, should use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  request: NextRequest,
  options: {
    limit?: number;
    window?: number;
    keyGenerator?: (req: NextRequest) => string;
  } = {}
) {
  const { limit = 100, window = 3600000, keyGenerator } = options; // 100 requests per hour by default

  const key = keyGenerator
    ? keyGenerator(request)
    : request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous";

  const now = Date.now();
  const resetTime = now + window;

  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetTime });
    return NextResponse.next();
  }

  if (current.count >= limit) {
    // Rate limit exceeded
    return new NextResponse("Rate limit exceeded", {
      status: 429,
      headers: {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": current.resetTime.toString(),
        "Retry-After": Math.ceil((current.resetTime - now) / 1000).toString(),
      },
    });
  }

  // Increment counter
  current.count++;

  return NextResponse.next();
}

/**
 * Performance monitoring middleware
 */
export function performanceMiddleware(request: NextRequest) {
  const { startTime, path } = ProductionMiddleware.monitorRequest(request);

  return NextResponse.next();
}

/**
 * Security headers middleware
 */
export function securityMiddleware(request: NextRequest) {
  const response = NextResponse.next();

  return ProductionMiddleware.addSecurityHeaders(response);
}

/**
 * Memory monitoring middleware
 */
export function memoryMiddleware(request: NextRequest) {
  // Monitor memory usage on every request
  MemoryOptimizer.monitorMemoryUsage();

  return NextResponse.next();
}

/**
 * Combined production middleware
 */
export function productionMiddleware(request: NextRequest) {
  const startTime = performance.now();

  try {
    // Apply all middleware
    let response = rateLimitMiddleware(request, {
      limit: 1000, // 1000 requests per hour
      window: 3600000, // 1 hour
      keyGenerator: (req) => {
        // Use IP + User-Agent for better rate limiting
        const ip =
          req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
        const userAgent = req.headers.get("user-agent") || "unknown";
        return `${ip}-${userAgent.slice(0, 50)}`;
      },
    });

    // If rate limit exceeded, return early
    if (response.status === 429) {
      return response;
    }

    // Apply security headers
    response = ProductionMiddleware.addSecurityHeaders(response);

    // Add performance monitoring
    const path = request.nextUrl.pathname;
    PerformanceMonitor.recordMetric(`request.${path}`, performance.now() - startTime);

    // Monitor memory usage
    MemoryOptimizer.monitorMemoryUsage();

    // Add cache headers based on path
    if (path.startsWith("/api/")) {
      response.headers.set("Cache-Control", "public, max-age=300, s-maxage=600");
    } else if (path.startsWith("/_next/static/")) {
      response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (path.endsWith(".json") || path.endsWith(".js") || path.endsWith(".css")) {
      response.headers.set("Cache-Control", "public, max-age=86400");
    }

    return response;
  } catch (error) {
    console.error("[ProductionMiddleware] Error:", error);
    return NextResponse.next();
  }
}

/**
 * API-specific middleware
 */
export function apiMiddleware(request: NextRequest) {
  const startTime = performance.now();
  const path = request.nextUrl.pathname;

  // Rate limiting for API endpoints
  let response = rateLimitMiddleware(request, {
    limit: 1000,
    window: 3600000,
    keyGenerator: (req) => {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
      return `api-${ip}`;
    },
  });

  // Add API-specific headers
  response.headers.set("X-API-Version", "1.0");
  response.headers.set("X-Response-Time", `${performance.now() - startTime}ms`);

  return response;
}

/**
 * Static asset middleware
 */
export function staticAssetMiddleware(request: NextRequest) {
  const response = NextResponse.next();

  // Long cache for static assets
  response.headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return response;
}
