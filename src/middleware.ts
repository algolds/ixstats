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
 * Generate Content Security Policy
 * Protects against XSS, clickjacking, and other code injection attacks
 */
function generateCSP(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  // Base CSP directives
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-eval' 'unsafe-inline' 'nonce-${nonce}' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https: http:`, // Allow external images (flags, etc)
    `font-src 'self' https://fonts.gstatic.com data:`,
    `connect-src 'self' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev https://api.clerk.com https://ixwiki.com https://commons.wikimedia.org https://api.unsplash.com https://*.tile.openstreetmap.org https://demotiles.maplibre.org wss: ws:`,
    `frame-src 'self' https://clerk.ixwiki.com https://accounts.ixwiki.com`,
    `worker-src 'self' blob:`, // Allow workers from same origin and blob URLs
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  // Relax CSP in development for hot reload
  if (isDevelopment) {
    directives.push(`script-src-elem 'self' 'unsafe-inline' https://*.clerk.accounts.dev`);
  }

  return directives.join("; ");
}

/**
 * Add comprehensive security and performance headers to response
 */
function enhanceResponse(
  response: NextResponse,
  req: NextRequest,
  userId: string | null
): NextResponse {
  // Generate nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Content Security Policy
  response.headers.set("Content-Security-Policy", generateCSP(nonce));
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

  // Request tracking
  const requestId = crypto.randomUUID();
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("X-Request-Time", new Date().toISOString());

  // Add request ID to response for logging
  response.headers.set("X-Trace-ID", requestId);

  return response;
}

// If Clerk is not configured, use a simple middleware that doesn't handle auth
function simpleMiddleware(req: NextRequest) {
  const response = NextResponse.next();
  return enhanceResponse(response, req, null);
}

export default isClerkConfigured
  ? clerkMiddleware(async (auth, req) => {
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
