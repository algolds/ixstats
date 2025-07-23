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
const isUsingTestKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_');
const isUsingLiveKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_');

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
        isSignedIn: clerkUser.isSignedIn,
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

export function SignInButton({ children, mode, ...props }: { children?: React.ReactNode; mode?: string; [key: string]: any }) {
  if (!isClerkConfigured) {
    // Return a placeholder button when Clerk is disabled
    return (
      <button 
        {...props}
        onClick={() => {
          const envType = isDevEnvironment ? 'development' : 'production';
          const keyType = isDevEnvironment ? 'pk_test_* and sk_test_*' : 'pk_live_* and sk_live_*';
          const envFile = isDevEnvironment ? '.env.local' : '.env.production';
          alert(`Authentication is not configured for ${envType}.\n\nTo enable authentication:\n1. Add ${keyType} Clerk keys to ${envFile}\n2. Restart the ${envType} server`);
        }}
        className={props.className}
        title="Authentication is not configured in this environment"
      >
        {children || `Sign In (${isDevEnvironment ? 'Dev' : 'Prod'} Mode)`}
      </button>
    );
  }

  // Warn in development if using live keys
  if (isDevEnvironment && isUsingLiveKeys) {
    console.warn('⚠️ WARNING: Using live Clerk keys in development. Switch to test keys (pk_test_*, sk_test_*) for development.');
  }

  // Warn in production if using test keys
  if (!isDevEnvironment && isUsingTestKeys) {
    console.warn('⚠️ WARNING: Using test Clerk keys in production. Switch to live keys (pk_live_*, sk_live_*) for production.');
  }
  
  // Use actual Clerk SignInButton when configured
  return (
    <ClerkSignInButton mode={mode as any} {...props}>
      {children}
    </ClerkSignInButton>
  );
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