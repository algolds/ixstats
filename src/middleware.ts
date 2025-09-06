import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

// Get base path from environment - should match Next.js basePath
const BASE_PATH = process.env.BASE_PATH || "";

const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/profile(.*)',
  // Setup page should be accessible without authentication when using fallback auth
  // '/setup(.*)',
]);

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api(.*)',
  '/countries',
  '/countries/(.*)',
  '/thinkpages',
  '/thinkpages/(.*)',
  '/builder',
  '/builder/(.*)',
]);

// Check if Clerk is configured with valid keys
const isClerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && 
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY.startsWith('sk_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_')
);

// If Clerk is not configured, use a simple middleware that doesn't handle auth
function simpleMiddleware(_req: NextRequest) {
  return NextResponse.next();
}

export default isClerkConfigured 
  ? clerkMiddleware(async (auth, req) => {
      // Allow public routes to pass through without auth
      if (isPublicRoute(req)) {
        return NextResponse.next();
      }
      
      // For protected routes, check authentication
      if (isProtectedRoute(req)) {
        const { userId } = await auth();
        if (!userId) {
          // Build the redirect URL with the return path
          const currentPath = req.nextUrl.pathname + req.nextUrl.search;
          const returnUrl = encodeURIComponent(`${BASE_PATH}${currentPath}`);
          
          // Build absolute sign-in URL based on environment
          const baseUrl = req.nextUrl.origin;
          let signInUrl: string;
          
          if (process.env.NODE_ENV === "production") {
            signInUrl = `https://accounts.ixwiki.com/sign-in?redirect_url=${returnUrl}`;
          } else {
            // For development, ensure we construct a proper absolute URL
            const signInPath = `${BASE_PATH}/sign-in`;
            signInUrl = `${baseUrl}${signInPath}?redirect_url=${returnUrl}`;
          }
            
          console.log(`[Middleware] Redirecting to: ${signInUrl}`);
          return NextResponse.redirect(new URL(signInUrl));
        }
      }
      
      // For all other routes, continue without auth requirement
      return NextResponse.next();
    })
  : simpleMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}; 