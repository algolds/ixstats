import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { type NextRequest, NextResponse } from "next/server";
import { isStandaloneRequest } from "~/lib/system/standalone-detection";

// Get base path from environment - should match Next.js basePath
const BASE_PATH = process.env.BASE_PATH || "";

// Production optimizations enabled
const ENABLE_COMPRESSION = process.env.ENABLE_COMPRESSION === "true";
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED === "true";

const isProtectedRoute = createRouteMatcher([
  "/admin(.*)",
  "/settings(.*)",
  // Setup page should be accessible without authentication when using fallback auth
  // '/setup(.*)',
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/id(.*)",
  "/r/(.*)",
  "/api(.*)",
  "/countries",
  "/countries/(.*)",
  "/thinkpages",
  "/thinkpages/(.*)",
  "/builder",
  "/builder/(.*)",
  "/maps",
  "/maps/(.*)",
  "/IxEconomy.xlsx",
]);

// Note: Clerk configuration check is now performed dynamically in getClerkMiddleware()

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
function buildCSPTemplate(standalone: boolean): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  // Use nonce-based script-src for both main app and standalone IxWorld
  // strict-dynamic allows scripts with a valid nonce to load additional scripts
  const scriptSrc = isDevelopment
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev`
    : `script-src 'self' 'unsafe-inline' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev https://static.cloudflareinsights.com`;

  const directives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https: http:`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `connect-src 'self' https: wss: ws:`,
    `frame-src 'self' https://clerk.ixwiki.com https://accounts.ixwiki.com https://maps.ixwiki.com`,
    `worker-src 'self' blob:`,
    `media-src 'self' https://ixwiki.com data: blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  if (isDevelopment) {
    directives.push(`script-src-elem 'self' 'unsafe-inline' https://*.clerk.accounts.dev`);
  }

  return directives.join("; ");
}

// Pre-compute both CSP templates at module load — select per-request by hostname
const CSP_TEMPLATE_APP = buildCSPTemplate(false);
const CSP_TEMPLATE_STANDALONE = buildCSPTemplate(true);

/**
 * Paths that should be embeddable via iframe from any origin:
 * - /maps — map pages with ?embed=true
 * - /wiki/ — WikiOS article pages
 * - /countries/ — country detail pages
 */
function isEmbeddablePathFn(pathname: string): boolean {
  return (
    pathname.startsWith("/maps") ||
    pathname.startsWith("/wiki/") ||
    pathname.startsWith("/countries/")
  );
}

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

  // Content Security Policy — select template by hostname, inject nonce
  const isForumWidget = req.nextUrl.pathname.startsWith("/forum/");
  const isEmbeddablePath =
    isEmbeddablePathFn(req.nextUrl.pathname) || isStandaloneRequest(req.headers);
  const cspTemplate = isStandaloneRequest(req.headers) ? CSP_TEMPLATE_STANDALONE : CSP_TEMPLATE_APP;
  let csp = cspTemplate.replaceAll("__NONCE__", nonce);
  if (isForumWidget) {
    // Allow iframe embedding from forum.ixwiki.com for widget pages
    csp = csp.replace("frame-ancestors 'none'", "frame-ancestors https://forum.ixwiki.com");
  } else if (isEmbeddablePath) {
    // Allow iframe embedding from any origin for maps, wiki articles, and country pages
    csp = csp.replace("frame-ancestors 'none'", "frame-ancestors *");
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-CSP-Nonce", nonce);

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (!isForumWidget && !isEmbeddablePath) {
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
 * When the request comes from maps.ixwiki.com, redirect root to /maps.
 * All other routes are served as-is.
 */
function handleStandaloneRouting(req: NextRequest): NextResponse | null {
  if (!isStandaloneRequest(req.headers)) return null;

  const pathname = req.nextUrl.pathname;

  // Root → redirect to /maps
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/maps", req.nextUrl.origin));
  }

  return null;
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

// SSE endpoints must bypass Clerk middleware — streaming ReadableStream
// responses are incompatible with Clerk's cookie/session header rewriting.
const SSE_ENDPOINTS = ["/api/sse/map-updates", "/api/sse"];

let clerkMiddlewareInstance: any = null;
let isClerkChecked = false;

function getClerkMiddleware() {
  if (isClerkChecked) return clerkMiddlewareInstance;
  isClerkChecked = true;

  const isConfigured = Boolean(
    process.env.CLERK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY.startsWith("sk_") &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith("pk_")
  );

  if (isConfigured) {
    try {
      console.log("[Middleware] Clerk keys detected, initializing Clerk middleware...");
      clerkMiddlewareInstance = clerkMiddleware(async (auth, req) => {
        // SSE endpoints must bypass Clerk — streaming responses are incompatible
        // with Clerk's session token/cookie rewriting. Return early with headers only.
        if (SSE_ENDPOINTS.some((p) => req.nextUrl.pathname.startsWith(p))) {
          const response = NextResponse.next();
          return enhanceResponse(response, req, null);
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
            const signInPath = `${BASE_PATH}/sign-in`;
            const signInUrl = `${baseUrl}${signInPath}?redirect_url=${returnUrl}`;

            console.log(`[Middleware] Redirecting to: ${signInUrl}`);
            return NextResponse.redirect(new URL(signInUrl));
          }

          // Check for admin role on /admin routes
          if (req.nextUrl.pathname.startsWith("/admin")) {
            // Use centralized system owner constants
            const { isSystemOwner } = await import("~/lib/auth");
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
      });
      console.log("[Middleware] Clerk middleware initialized successfully.");
    } catch (error) {
      console.error("[Middleware] Failed to initialize Clerk middleware:", error);
      clerkMiddlewareInstance = null;
    }
  } else {
    console.log("[Middleware] Clerk keys not configured or invalid, running in Demo/Simple mode.");
  }
  return clerkMiddlewareInstance;
}

export default async function middleware(req: NextRequest, event: any) {
  // Block spoofed internal headers (defense in depth for CVE-2025-29927)
  const internalHeader = req.headers.get("x-middleware-subrequest");
  if (internalHeader) {
    console.warn(
      `[Security] Blocked spoofed x-middleware-subrequest header from ${req.headers.get("x-forwarded-for") || "unknown"}`
    );
    return new NextResponse("Forbidden", { status: 403 });
  }

  const clerk = getClerkMiddleware();
  if (clerk) {
    try {
      return await clerk(req, event);
    } catch (error) {
      console.error(
        "[Middleware] Clerk middleware execution failed, falling back to simple middleware:",
        error
      );
      return simpleMiddleware(req);
    }
  }

  return simpleMiddleware(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
