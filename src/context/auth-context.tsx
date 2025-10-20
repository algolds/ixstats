"use client";

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import {
  useUser as useClerkUser,
  useAuth as useClerkAuth,
  SignInButton as ClerkSignInButton,
  SignOutButton as ClerkSignOutButton,
  UserButton as ClerkUserButton,
} from '@clerk/nextjs';
import type { GetTokenOptions, SignOutOptions, UserResource } from '@clerk/types';

interface AuthContextType {
  user: UserResource | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: (options?: SignOutOptions) => Promise<void>;
  getToken?: (options?: GetTokenOptions) => Promise<string | null>;
}

// Clerk is the default auth provider - always use it when available
const isClerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_')
);

const isDevEnvironment = process.env.NODE_ENV === 'development';
const isProductionEnvironment = process.env.NODE_ENV === 'production';
const isUsingTestKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_');
const isUsingLiveKeys = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_');

// Production environment validation
// Note: Clerk's built-in "development keys" warning is expected in development
// and does not indicate an error - it's just Clerk reminding developers
// not to use development keys in production environments.
if (typeof window === 'undefined') { // Server-side only
  if (isProductionEnvironment && !isUsingLiveKeys && isClerkConfigured) {
    console.warn('⚠️  PRODUCTION WARNING: Not using live Clerk keys in production environment');
  }
  if (isDevEnvironment && isUsingLiveKeys) {
    console.warn('⚠️  DEVELOPMENT WARNING: Using live Clerk keys in development environment');
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

function assertClerkConfigured(component: string) {
  if (!isClerkConfigured) {
    throw new Error(
      `[${component}] Clerk is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_*) and CLERK_SECRET_KEY (sk_*) before rendering authentication components.`
    );
  }
}

// Conditional AuthProvider that only uses Clerk hooks when Clerk is configured
function ClerkAuthProvider({ children }: { children: React.ReactNode }) {
  const clerkUser = useClerkUser();
  const clerkAuth = useClerkAuth();

  // Memoize auth value to prevent unnecessary re-renders
  const authValue: AuthContextType = useMemo(() => {
    return {
      user: clerkUser.user ?? null,
      isLoaded: clerkUser.isLoaded,
      isSignedIn: Boolean(clerkUser.isSignedIn),
      signOut: clerkAuth.signOut,
      getToken: clerkAuth.getToken,
    };
  }, [clerkUser, clerkAuth]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  assertClerkConfigured('AuthProvider');
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
}

// Custom hooks that work with or without Clerk
export function useUser() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('[useUser] must be used within <AuthProvider>.');
  }
  return {
    user: context.user,
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
  };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('[useAuth] must be used within <AuthProvider>.');
  }
  return {
    isLoaded: context.isLoaded,
    isSignedIn: context.isSignedIn,
    signOut: context.signOut,
    getToken: context.getToken,
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

export function SignOutButton(
  props: React.ComponentProps<typeof ClerkSignOutButton>
) {
  assertClerkConfigured('SignOutButton');
  return <ClerkSignOutButton {...props} />;
}

export function SignInButton(
  props: React.ComponentProps<typeof ClerkSignInButton>
) {
  assertClerkConfigured('SignInButton');

  useEffect(() => {
    if (isDevEnvironment && isUsingLiveKeys) {
      console.warn(
        '⚠️ DEVELOPMENT WARNING: Using live Clerk keys in development. Switch to test keys (pk_test_*, sk_test_*) for development.'
      );
    } else if (isProductionEnvironment && isUsingTestKeys) {
      console.error(
        '🚨 PRODUCTION ERROR: Using test Clerk keys in production! Switch to live keys (pk_live_*, sk_live_*) for production.'
      );
    }
  }, []);

  return <ClerkSignInButton {...props} />;
}

export function UserButton(props: React.ComponentProps<typeof ClerkUserButton>) {
  assertClerkConfigured('UserButton');
  return <ClerkUserButton {...props} />;
}
