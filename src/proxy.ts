import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";

// Get base path from environment - should match Next.js basePath
const BASE_PATH = process.env.BASE_PATH || "";

// Production optimizations enabled
const ENABLE_COMPRESSION = process.env.ENABLE_COMPRESSION === "true";
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === "true";

const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/profile(.*)",
  // Setup page should be accessible without authentication when using fallback auth
  // '/setup(.*)',
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api(.*)",
  "/countries",
  "/countries/(.*)",
  "/thinkpages",
  "/thinkpages/(.*)",
  "/builder",
  "/builder/(.*)",
]);

// Check if Clerk is configured with valid keys
const isClerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY.startsWith("sk_") &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_")
);

/**
 * Content Security Policy — pre-computed at module load time.
 *
 * SECURITY: Uses nonce-based script execution to prevent XSS attacks.
 * - Scripts must have the correct nonce attribute to execute
 * - unsafe-inline is ONLY used for styles (required by many UI libraries)
 * - unsafe-eval is REMOVED to prevent dynamic code execution attacks
 *
 * The static template is built once and the __NONCE__ placeholder is replaced
 * per-request. This avoids rebuilding ~1KB of string concatenation on every request.
 *
 * If Clerk SDK breaks, check: https://clerk.com/docs/security/csp
 */
function buildCSPTemplate(): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  const directives = [
    `default-src 'self'`,
    isDevelopment
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev`
      : `script-src 'self' 'nonce-__NONCE__' 'strict-dynamic' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https: http:`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `connect-src 'self' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev https://api.clerk.com https://ixwiki.com https://commons.wikimedia.org https://api.unsplash.com https://*.tile.openstreetmap.org https://demotiles.maplibre.org wss: ws:`,
    `frame-src 'self' https://clerk.ixwiki.com https://accounts.ixwiki.com`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  if (isDevelopment) {
    directives.push(
      `script-src-elem 'self' 'unsafe-inline' https://*.clerk.accounts.dev`
    );
  }

  return directives.join("; ");
}

// Pre-compute once at module load — only the nonce changes per request
const CSP_TEMPLATE = buildCSPTemplate();

/**
 * Add comprehensive security and performance headers to response
 */
function enhanceResponse(
  response: NextResponse,
  req: NextRequest,
  userId: string | null
): NextResponse {
  // Single UUID for both nonce and request tracking (one crypto call instead of two)
  const requestId = crypto.randomUUID();
  const nonce = Buffer.from(requestId).toString("base64");

  // Content Security Policy — inject nonce into pre-computed template
  response.headers.set("Content-Security-Policy", CSP_TEMPLATE.replaceAll("__NONCE__", nonce));
  response.headers.set("X-CSP-Nonce", nonce);

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // HSTS (HTTP Strict Transport Security) - only in production
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // Rate limiting identifier header
  if (RATE_LIMIT_ENABLED && req.nextUrl.pathname.startsWith("/api")) {
    const identifier = userId || req.headers.get("x-forwarded-for") || "anonymous";
    response.headers.set("X-RateLimit-Identifier", identifier);
  }

  // Request tracking (reuse requestId from above)
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("X-Request-Time", new Date().toISOString());
  response.headers.set("X-Trace-ID", requestId);

  return response;
}

// If Clerk is not configured, use a simple middleware that doesn't handle auth
function simpleMiddleware(req: NextRequest) {
  // Block spoofed internal headers (defense in depth for CVE-2025-29927)
  const internalHeader = req.headers.get("x-middleware-subrequest");
  if (internalHeader) {
    console.warn(
      `[Security] Blocked spoofed x-middleware-subrequest header from ${req.headers.get("x-forwarded-for") || "unknown"}`
    );
    return new NextResponse("Forbidden", { status: 403 });
  }

  const response = NextResponse.next();
  return enhanceResponse(response, req, null);
}

export default isClerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      // Block spoofed internal headers (defense in depth for CVE-2025-29927)
      const internalHeader = req.headers.get("x-middleware-subrequest");
      if (internalHeader) {
        console.warn(
          `[Security] Blocked spoofed x-middleware-subrequest header from ${req.headers.get("x-forwarded-for") || "unknown"}`
        );
        return new NextResponse("Forbidden", { status: 403 });
      }

      const { userId, sessionClaims } = await auth();

      // Allow public routes to pass through without auth
      if (isPublicRoute(req)) {
        const response = NextResponse.next();
        return enhanceResponse(response, req, userId);
      }

      // For protected routes, check authentication
      if (isProtectedRoute(req)) {
        if (!userId) {
          // Build the redirect URL with the return path
          const currentPath = req.nextUrl.pathname + req.nextUrl.search;
          const prefixedPath =
            BASE_PATH && currentPath.startsWith(BASE_PATH)
              ? currentPath
              : `${BASE_PATH}${currentPath.startsWith("/") ? currentPath : `/${currentPath}`}`;
          const returnUrl = encodeURIComponent(prefixedPath);

          // Build absolute sign-in URL based on environment
          const baseUrl = req.nextUrl.origin;
          let signInUrl: string;

          const signInPath = `${BASE_PATH}/sign-in`;
          signInUrl = `${baseUrl}${signInPath}?redirect_url=${returnUrl}`;

          console.log(`[Middleware] Redirecting to: ${signInUrl}`);
          return NextResponse.redirect(new URL(signInUrl));
        }

        // Check for admin role on /admin routes
        if (req.nextUrl.pathname.startsWith("/admin")) {
          // Use centralized system owner constants
          const { isSystemOwner } = await import("~/lib/system-owner-constants");
          const isSystemOwnerUser = isSystemOwner(userId);

          if (!isSystemOwnerUser) {
            const publicMetadata = sessionClaims?.publicMetadata as { role?: string } | undefined;
            const userRole = publicMetadata?.role;

            if (userRole !== "admin") {
              console.log(
                `[Middleware] Access denied to /admin for user ${userId} with role ${userRole || "none"}`
              );
              // Redirect to home page with access denied message
              const homeUrl = new URL(`${BASE_PATH}/`, req.nextUrl.origin);
              homeUrl.searchParams.set("error", "access_denied");
              return NextResponse.redirect(homeUrl);
            }
          } else {
            console.log(`[Middleware] System owner ${userId} granted admin access`);
          }
        }
      }

      // For all other routes, continue without auth requirement
      const response = NextResponse.next();
      return enhanceResponse(response, req, userId);
    })
  : simpleMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
