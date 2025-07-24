"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
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

// Enhanced logging for environment and key detection
if (typeof window === 'undefined') { // Server-side only
  console.log('🔐 Clerk Configuration Check:');
  console.log(`   Environment: ${process.env.NODE_ENV}`);
  console.log(`   Has Publishable Key: ${!!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}`);
  console.log(`   Key Type: ${isUsingTestKeys ? 'TEST' : isUsingLiveKeys ? 'LIVE' : 'NONE/INVALID'}`);
  console.log(`   Is Configured: ${isClerkConfigured}`);
  
  if (isProductionEnvironment && !isUsingLiveKeys) {
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
  const [fallbackAuth, setFallbackAuth] = useState<AuthContextType>({
    user: null,
    isLoaded: true,
    isSignedIn: false,
  });

  // Use Clerk hooks only if Clerk is configured
  const clerkUser = isClerkConfigured ? useClerkUser() : null;
  const clerkAuth = isClerkConfigured ? useClerkAuth() : null;

  useEffect(() => {
    if (!isClerkConfigured) {
      // Set up fallback auth state for demo/development
      setFallbackAuth({
        user: null, // No user when Clerk is disabled
        isLoaded: true,
        isSignedIn: false,
      });
    }
  }, []);

  // Return Clerk auth if configured, otherwise fallback
  const authValue: AuthContextType = isClerkConfigured && clerkUser && clerkAuth 
    ? {
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
      }
    : fallbackAuth;

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

  if (!isClerkConfigured) {
    const handleClick = () => {
      const envType = isDevEnvironment ? 'development' : 'production';
      const keyType = isDevEnvironment ? 'pk_test_* and sk_test_*' : 'pk_live_* and sk_live_*';
      const envFile = isDevEnvironment ? '.env.local' : '.env.production';
      alert(`Authentication is not configured for ${envType}.\n\nTo enable authentication:\n1. Add ${keyType} Clerk keys to ${envFile}\n2. Restart the ${envType} server`);
    };

    // Use consistent props for both server and client to avoid hydration mismatch
    const commonProps = {
      onClick: handleClick,
      title: "Authentication is not configured in this environment"
    };

    if (asChild && children && React.isValidElement(children)) {
      // Clone the child element and add our click handler, but filter out asChild prop
      return React.cloneElement(children, commonProps);
    }

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

  // Environment-specific key warnings
  if (isDevEnvironment && isUsingLiveKeys) {
    console.warn('⚠️ DEVELOPMENT WARNING: Using live Clerk keys in development. Switch to test keys (pk_test_*, sk_test_*) for development.');
  }

  if (isProductionEnvironment && isUsingTestKeys) {
    console.error('🚨 PRODUCTION ERROR: Using test Clerk keys in production! Switch to live keys (pk_live_*, sk_live_*) for production.');
    // Show a more prominent warning in production
    if (typeof window !== 'undefined') {
      console.error('🚨 Authentication will not work properly in production with test keys!');
    }
  }

  // Success message for correct key usage
  if (isProductionEnvironment && isUsingLiveKeys) {
    console.log('✅ Production Clerk keys correctly configured');
  }
  if (isDevEnvironment && isUsingTestKeys) {
    console.log('✅ Development Clerk keys correctly configured');
  }
  
  // Only render Clerk SignInButton on the client to avoid hydration mismatch
  if (!isMounted) {
    // Return a placeholder that matches the final rendered output
    if (asChild && children && React.isValidElement(children)) {
      return React.cloneElement(children, { onClick: () => {} });
    }
    return (
      <button className={props.className} onClick={() => {}}>
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