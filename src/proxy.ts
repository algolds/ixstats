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
  "/maps",
  "/maps/(.*)",
]);

// IxWorld standalone mode: when running as maps.ixwiki.com, restrict routes
const IXWORLD_STANDALONE =
  process.env.NEXT_PUBLIC_IXWORLD_STANDALONE === "true";
const IXWORLD_ALLOWED_PREFIXES = [
  "/maps",
  "/api",
  "/countries",
  "/flags",
  "/_next",
  "/sign-in",
  "/sign-up",
];

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

  // IxWorld standalone: relaxed CSP since nonce propagation doesn't work
  // in standalone builds and the map viewer is public content only
  const scriptSrc = isDevelopment
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev`
    : IXWORLD_STANDALONE
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev https://static.cloudflareinsights.com`
      : `script-src 'self' 'nonce-__NONCE__' 'strict-dynamic' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev`;

  const directives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https: http:`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `connect-src 'self' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev https://api.clerk.com https://ixwiki.com https://commons.wikimedia.org https://api.unsplash.com https://*.tile.openstreetmap.org https://demotiles.maplibre.org https://protomaps.github.io wss: ws:`,
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
  const isForumWidget = req.nextUrl.pathname.startsWith("/forum/");
  let csp = CSP_TEMPLATE.replaceAll("__NONCE__", nonce);
  if (isForumWidget) {
    // Allow iframe embedding from forum.ixwiki.com for widget pages
    csp = csp.replace("frame-ancestors 'none'", "frame-ancestors https://forum.ixwiki.com");
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-CSP-Nonce", nonce);

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (!isForumWidget) {
    response.headers.set("X-Frame-Options", "DENY");
  }
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

/**
 * IxWorld standalone route guard.
 * In standalone mode (maps.ixwiki.com), only maps-related routes are served.
 * All other routes redirect to the main IxStats instance.
 */
function handleStandaloneRouting(req: NextRequest): NextResponse | null {
  if (!IXWORLD_STANDALONE) return null;

  const pathname = req.nextUrl.pathname;

  // Root → redirect to /maps
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/maps", req.nextUrl.origin));
  }

  // Allow favicon and allowed route prefixes
  if (
    pathname === "/favicon.ico" ||
    IXWORLD_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p))
  ) {
    return null;
  }

  // Everything else → redirect to main IxStats
  return NextResponse.redirect(
    `https://ixwiki.com/projects/ixstats${pathname}`
  );
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

  // IxWorld standalone route guard
  const standaloneRedirect = handleStandaloneRouting(req);
  if (standaloneRedirect) return standaloneRedirect;

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

      // IxWorld standalone route guard
      const standaloneRedirect = handleStandaloneRouting(req);
      if (standaloneRedirect) return standaloneRedirect;

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
