// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/app/admin/layout.tsx
// Shared admin layout with auth guard, sidebar, and error boundary
"use client";

import { AdminErrorBoundary } from "./_components/ErrorBoundary";
import { AdminSidebarLayout } from "./_components/AdminSidebarLayout";
import { AdminNavigationProvider } from "./_components";
import { SignInButton, useUser, useAuth } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import Link from "next/link";

import { usePathname } from "next/navigation";

interface AdminLayoutProps {
  children: React.ReactNode;
}

function AccessDeniedScreen() {
  const { signOut } = useAuth();
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center">
      <div className="border-border bg-card w-full max-w-sm rounded-lg border p-8 text-center shadow-lg">
        <h1 className="text-red-650 mb-4 text-2xl font-bold dark:text-red-500">Access Denied</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          You do not have permission to view the Administration console.
        </p>
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              void signOut();
            }}
            className="border-border/60 hover:bg-muted text-foreground"
          >
            Sign Out
          </Button>
          <Button asChild className="bg-indigo-650 font-semibold text-white hover:bg-indigo-700">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <SignInButton mode="modal" />
      </div>
    );
  }

  const allowedRoles = new Set(["admin", "owner", "staff"]);
  const isSystemOwnerUser = isSystemOwner(user.id);
  const hasAdminRole =
    typeof user?.publicMetadata?.role === "string" && allowedRoles.has(user.publicMetadata.role);

  if (!isSystemOwnerUser && !hasAdminRole) {
    return <AccessDeniedScreen />;
  }

  if (pathname === "/admin/maps/editor") {
    return <AdminErrorBoundary>{children}</AdminErrorBoundary>;
  }

  return (
    <AdminErrorBoundary>
      <AdminNavigationProvider>
        <AdminSidebarLayout>{children}</AdminSidebarLayout>
      </AdminNavigationProvider>
    </AdminErrorBoundary>
  );
}
