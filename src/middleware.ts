import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/profile(.*)',
  // Setup page should be accessible without authentication when using fallback auth
  // '/setup(.*)',
]);

// Check if Clerk is configured with valid keys
const isClerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && 
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.CLERK_SECRET_KEY.startsWith('sk_') &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.startsWith('pk_')
);

// If Clerk is not configured, use a simple middleware that doesn't handle auth
function simpleMiddleware(req: NextRequest) {
  return NextResponse.next();
}

export default isClerkConfigured 
  ? clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req)) {
        const { userId } = await auth();
        if (!userId) {
          // Explicitly redirect to the custom Clerk domain
          return NextResponse.redirect('https://accounts.ixwiki.com/sign-in');
        }
      }
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