import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  type NextRequest,
  type NextFetchEvent,
  type NextMiddleware,
  NextResponse,
} from "next/server";
import { isStandaloneRequest } from "~/lib/system/standalone-detection";
import {
  WikiStandaloneConfigError,
  isWikiStandalone,
  wikiStandaloneRedirect,
} from "~/lib/system/wikios-standalone";
import { buildCSPTemplate, renderCsp } from "~/lib/security/csp";
import { RAW_PATH_HEADER, RAW_ROUTE_PATH } from "~/lib/wiki-os/raw-path";

// Get base path from environment - should match Next.js basePath
const BASE_PATH = process.env.BASE_PATH || "";

// Production optimizations enabled
// oxlint-disable-next-line typescript/no-unused-vars
const ENABLE_COMPRESSION = process.env.ENABLE_COMPRESSION === "true";

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
  "/@(.*)",
  "/r/(.*)",
  "/api(.*)",
  "/countries",
  "/countries/(.*)",
  // Feed posts and persona profiles were public under /thinkpages/(.*) and stay public here (ThinkPages phase 5).
  "/dashboard/post/(.*)",
  "/dashboard/profile/(.*)",
  "/thinkpages",
  "/thinkpages/(.*)",
  "/builder",
  "/builder/(.*)",
  "/maps",
  "/maps/(.*)",
  "/IxEconomy.xlsx",
]);

// Note: Clerk configuration check is now performed dynamically in getClerkMiddleware()

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
 * Continue to the app with the security headers set (PL-2).
 *
 * The per-request CSP nonce goes on the forwarded *request* headers as well as the response:
 * Next.js reads the nonce from the request's `Content-Security-Policy` to put it on its own
 * inline scripts, and the root layout reads `x-csp-nonce` to hand it to Clerk. Both are
 * overwritten here, so a client can't supply its own.
 */
function nextWithSecurityHeaders(req: NextRequest): NextResponse {
  // Single UUID for both nonce and request tracking (one crypto call instead of two)
  const requestId = crypto.randomUUID();
  const nonce = Buffer.from(requestId).toString("base64");

  // Content Security Policy — select template by hostname, inject nonce
  const isEmbeddablePath =
    isEmbeddablePathFn(req.nextUrl.pathname) || isStandaloneRequest(req.headers);
  const cspTemplate = isStandaloneRequest(req.headers) ? CSP_TEMPLATE_STANDALONE : CSP_TEMPLATE_APP;
  let csp = renderCsp(cspTemplate, nonce);
  if (isEmbeddablePath) {
    // Allow iframe embedding from any origin for maps, wiki articles, and country pages
    csp = csp.replace("frame-ancestors 'none'", "frame-ancestors *");
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-csp-nonce", nonce);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (!isEmbeddablePath) {
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

/**
 * WikiOS standalone route guard (plan 417). Only active in the WikiOS standalone build: `/` goes to
 * the Main Page and any path WikiOS does not own goes to IxStates. Relative `Location` values are
 * valid and keep the public scheme/host that nginx terminates. A build without
 * NEXT_PUBLIC_IXSTATES_URL cannot redirect: it answers 500 and logs why, instead of guessing a URL.
 */
function handleWikiStandaloneRouting(req: NextRequest): NextResponse | null {
  if (!isWikiStandalone()) return null;
  try {
    const target = wikiStandaloneRedirect(req.nextUrl.pathname, req.nextUrl.search);
    if (!target) return null;
    return new NextResponse(null, { status: 302, headers: { location: target } });
  } catch (error) {
    if (!(error instanceof WikiStandaloneConfigError)) throw error;
    console.error(`[WikiOS standalone] ${error.message}`);
    return new NextResponse("WikiOS standalone build is misconfigured", { status: 500 });
  }
}

/**
 * `/wiki/<title>?action=raw` (MediaWiki's raw-wikitext URL, used by bots) is answered by
 * /api/wiki/raw. The path after `/wiki/` goes in a request header (`x-wikios-raw-path`, see
 * lib/wiki-os/raw-path.ts): a rewrite keeps the original query string, so a query parameter added
 * here would never reach the route. The header is set from the incoming headers with any value the
 * client sent overwritten.
 */
function handleWikiRawRewrite(req: NextRequest): NextResponse | null {
  const { pathname, searchParams } = req.nextUrl;
  if (!pathname.startsWith("/wiki/") || searchParams.get("action") !== "raw") return null;

  const url = req.nextUrl.clone();
  url.pathname = RAW_ROUTE_PATH;
  const headers = new Headers(req.headers);
  headers.set(RAW_PATH_HEADER, pathname.slice("/wiki/".length));
  return NextResponse.rewrite(url, { request: { headers } });
}

/**
 * A direct request to the raw route carrying `x-wikios-raw-path` is a client forging the proxy's
 * header: continue with it removed (the route needs neither Clerk nor the page security headers).
 */
function handleRawPathHeaderStrip(req: NextRequest): NextResponse | null {
  if (req.nextUrl.pathname !== RAW_ROUTE_PATH || !req.headers.has(RAW_PATH_HEADER)) return null;

  const headers = new Headers(req.headers);
  headers.delete(RAW_PATH_HEADER);
  return NextResponse.next({ request: { headers } });
}

/**
 * /admin and /settings are only gated inside the Clerk callback. When Clerk is
 * unavailable, those routes must fail closed instead of falling through unauthenticated.
 */
function protectedRouteUnavailable(req: NextRequest): NextResponse | null {
  if (!isProtectedRoute(req)) return null;
  return new NextResponse("Service temporarily unavailable", { status: 503 });
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

  return nextWithSecurityHeaders(req);
}

// SSE endpoints must bypass Clerk middleware — streaming ReadableStream
// responses are incompatible with Clerk's cookie/session header rewriting.
const SSE_ENDPOINTS = ["/api/sse/map-updates", "/api/sse"];

let clerkMiddlewareInstance: NextMiddleware | null = null;
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
          return nextWithSecurityHeaders(req);
        }

        // IxWorld standalone route guard
        const standaloneRedirect = handleStandaloneRouting(req);
        if (standaloneRedirect) return standaloneRedirect;

        const { userId, sessionClaims } = await auth();

        // Allow public routes to pass through without auth
        if (isPublicRoute(req)) {
          return nextWithSecurityHeaders(req);
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
        return nextWithSecurityHeaders(req);
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

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  // Block spoofed internal headers (defense in depth for CVE-2025-29927)
  const internalHeader = req.headers.get("x-middleware-subrequest");
  if (internalHeader) {
    console.warn(
      `[Security] Blocked spoofed x-middleware-subrequest header from ${req.headers.get("x-forwarded-for") || "unknown"}`
    );
    return new NextResponse("Forbidden", { status: 403 });
  }

  const wikiStandaloneRedirectResponse = handleWikiStandaloneRouting(req);
  if (wikiStandaloneRedirectResponse) return wikiStandaloneRedirectResponse;

  const wikiRawRewrite = handleWikiRawRewrite(req) ?? handleRawPathHeaderStrip(req);
  if (wikiRawRewrite) return wikiRawRewrite;

  const clerk = getClerkMiddleware();
  if (clerk) {
    try {
      return await clerk(req, event);
    } catch (error) {
      console.error(
        "[Middleware] Clerk middleware execution failed, falling back to simple middleware:",
        error
      );
      return protectedRouteUnavailable(req) ?? simpleMiddleware(req);
    }
  }

  // Dev without Clerk keys keeps working; production never serves protected routes unauthenticated.
  if (process.env.NODE_ENV === "production") {
    const unavailable = protectedRouteUnavailable(req);
    if (unavailable) return unavailable;
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
