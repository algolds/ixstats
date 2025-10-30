"use client";

import { useUser } from "~/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Crown, Globe, Activity, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import Link from "next/link";
import { createAbsoluteUrl } from "~/lib/url-utils";

interface AuthenticationGuardProps {
  children: React.ReactNode;
  redirectPath: string;
}

// Check if Clerk is configured
const isClerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_"));

export function AuthenticationGuard({ children, redirectPath }: AuthenticationGuardProps) {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && !user && isClerkConfigured) {
      const returnUrl = encodeURIComponent(createAbsoluteUrl(redirectPath));
      const signInUrl = createAbsoluteUrl("/sign-in");
      window.location.href = `${signInUrl}?redirect_url=${returnUrl}`;
    }
  }, [isLoaded, user, redirectPath]);

  // Clerk not configured
  if (!isClerkConfigured) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="glass-hierarchy-parent mx-auto max-w-2xl">
          <CardHeader className="text-center">
            <Crown className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <CardTitle className="text-2xl font-bold">Authentication Not Configured</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              User authentication is not set up for this application. Please contact an
              administrator to configure authentication or browse countries without signing in.
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => (window.location.href = createAbsoluteUrl("/countries"))}>
                <Globe className="mr-2 h-4 w-4" />
                Browse Countries
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = createAbsoluteUrl("/dashboard"))}
              >
                <Activity className="mr-2 h-4 w-4" />
                View Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state - show a simple loading spinner while Clerk loads
  if (!isLoaded) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // User not authenticated - should redirect but show fallback
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <Card className="mx-auto max-w-md">
            <CardContent className="p-6 text-center">
              <p>Redirecting to sign in...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // User is authenticated, render children
  return <>{children}</>;
}
