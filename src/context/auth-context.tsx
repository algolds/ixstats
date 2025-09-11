"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useUser as useClerkUser, useAuth as useClerkAuth, SignInButton as ClerkSignInButton, UserButton as ClerkUserButton } from '@clerk/nextjs';

// Define types that match Clerk's interface
interface User {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  emailAddresses: { emailAddress: string }[];
  imageUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut?: () => Promise<void>;
}

// Check if Clerk is configured and determine environment
const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')
);

const isDevEnvironment = process.env.NODE_ENV === 'development';
const isProductionEnvironment = process.env.NODE_ENV === 'production';
const isUsingTestKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_');
const isUsingLiveKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_');

// Production environment validation
if (typeof window === 'undefined') { // Server-side only
  if (isProductionEnvironment && !isUsingLiveKeys && isClerkConfigured) {
    console.warn('⚠️  PRODUCTION WARNING: Not using live Clerk keys in production environment');
  }
  if (isDevEnvironment && isUsingLiveKeys) {
    console.warn('⚠️  DEVELOPMENT WARNING: Using live Clerk keys in development environment');
  }
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoaded: true,
  isSignedIn: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Memoize fallback auth to prevent re-creation
  const fallbackAuth = useMemo<AuthContextType>(() => ({
    user: null,
    isLoaded: true,
    isSignedIn: false,
  }), []);

  // Use Clerk hooks only if Clerk is configured
  const clerkUser = isClerkConfigured ? useClerkUser() : null;
  const clerkAuth = isClerkConfigured ? useClerkAuth() : null;

  // Memoize auth value to prevent unnecessary re-renders
  const authValue: AuthContextType = useMemo(() => {
    if (isClerkConfigured && clerkUser && clerkAuth) {
      return {
        user: clerkUser.user ? {
          id: clerkUser.user.id,
          firstName: clerkUser.user.firstName,
          lastName: clerkUser.user.lastName,
          emailAddresses: clerkUser.user.emailAddresses,
          imageUrl: clerkUser.user.imageUrl,
        } : null,
        isLoaded: clerkUser.isLoaded,
        isSignedIn: Boolean(clerkUser.isSignedIn),
        signOut: clerkAuth.signOut,
      };
    }
    return fallbackAuth;
  }, [clerkUser, clerkAuth, fallbackAuth]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hooks that work with or without Clerk
export function useUser() {
  const context = useContext(AuthContext);
  return {
    user: context.user,
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    signOut: context.signOut || (() => Promise.resolve()),
  };
}

// Fallback components for when Clerk is not configured
export function SignedIn({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  return isSignedIn ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  return !isSignedIn ? <>{children}</> : null;
}

export function SignInButton({ children, mode, asChild, ...props }: { children?: React.ReactNode; mode?: string; asChild?: boolean; [key: string]: any }) {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Memoize click handler to prevent re-creation
  const handleFallbackClick = useCallback(() => {
    const envType = isDevEnvironment ? 'development' : 'production';
    const keyType = isDevEnvironment ? 'pk_test_* and sk_test_*' : 'pk_live_* and sk_live_*';
    const envFile = isDevEnvironment ? '.env.local' : '.env.production';
    alert(`Authentication is not configured for ${envType}.\n\nTo enable authentication:\n1. Add ${keyType} Clerk keys to ${envFile}\n2. Restart the ${envType} server`);
  }, []);

  if (!isClerkConfigured) {

    if (asChild && children && React.isValidElement(children)) {
      // Clone the child element and add our click handler, but filter out asChild prop
      // Don't add title to avoid hydration mismatch
      return React.cloneElement(children as any, {
        onClick: handleFallbackClick
      });
    }

    // Use consistent props for both server and client to avoid hydration mismatch
    const commonProps = {
      onClick: handleFallbackClick,
      title: "Authentication is not configured in this environment"
    };

    // Return a placeholder button when Clerk is disabled
    // Filter out props that shouldn't be passed to DOM elements
    const { asChild: _, mode: __, ...domProps } = props;
    return (
      <button 
        {...domProps}
        {...commonProps}
      >
        {children || (
          <div className="flex items-center gap-2">
            <span>{`Sign In (${isDevEnvironment ? 'Dev' : 'Prod'} Mode)`}</span>
          </div>
        )}
      </button>
    );
  }

  // Environment-specific key warnings - only log once
  useEffect(() => {
    if (isDevEnvironment && isUsingLiveKeys) {
      console.warn('⚠️ DEVELOPMENT WARNING: Using live Clerk keys in development. Switch to test keys (pk_test_*, sk_test_*) for development.');
    }

    if (isProductionEnvironment && isUsingTestKeys) {
      console.error('🚨 PRODUCTION ERROR: Using test Clerk keys in production! Switch to live keys (pk_live_*, sk_live_*) for production.');
      console.error('🚨 Authentication will not work properly in production with test keys!');
    }

    // Log success only in development for debugging
    if (isDevEnvironment && isUsingTestKeys) {
      console.log('✅ Development Clerk keys correctly configured');
    }
  }, []); // Only run once
  
  // Only render Clerk SignInButton on the client to avoid hydration mismatch
  if (!isMounted) {
    // Return a placeholder that matches the final rendered output
    // Don't add title attribute to avoid hydration mismatch with Clerk components
    if (asChild && children && React.isValidElement(children)) {
      return React.cloneElement(children as any, { 
        onClick: () => {}
      });
    }
    return (
      <button 
        className={props.className} 
        onClick={() => {}}
      >
        {children || (
          <div className="flex items-center gap-2">
            <span>Sign In</span>
          </div>
        )}
      </button>
    );
  }

  // Use actual Clerk SignInButton when configured and mounted
  if (asChild && children && React.isValidElement(children)) {
    // For asChild pattern, filter out asChild prop since ClerkSignInButton doesn't support it
    const { asChild: _, ...clerkProps } = props;
    return (
      <ClerkSignInButton mode={mode as any} {...clerkProps}>
        {children}
      </ClerkSignInButton>
    );
  } else {
    // For normal button pattern, pass through all props
    return (
      <ClerkSignInButton mode={mode as any} {...props}>
        {children}
      </ClerkSignInButton>
    );
  }
}

export function UserButton(props: any) {
  const { user } = useUser();
  
  if (!isClerkConfigured || !user) {
    // Return a placeholder when Clerk is disabled or no user
    return (
      <div className={props.className || "w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm"}>
        ?
      </div>
    );
  }
  
  // Use actual Clerk UserButton when configured and user is signed in
  return <ClerkUserButton {...props} />;
}