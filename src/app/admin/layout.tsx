"use client";
// src/app/admin/layout.tsx
// Shared admin layout with auth guard, sidebar, and error boundary

import { AdminErrorBoundary } from "./_components/ErrorBoundary";
import { AdminSidebarLayout } from "./_components/AdminSidebarLayout";
import { AdminNavigationProvider } from "./_components/AdminNavigationContext";
import { SignInButton, useUser, useAuth } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "~/hooks/usePermissions";
import { PortalTintSync } from "~/components/providers/PortalTintSync";
import { Card } from "~/components/ui/card";

interface AdminLayoutProps {
  children: React.ReactNode;
}

function AccessDeniedScreen() {
  const { signOut } = useAuth();
  return (
    <div className="bg-grouped text-label flex min-h-screen flex-col items-center justify-center p-4">
      <Card padding="lg" className="w-full max-w-sm text-center">
        <h1 className="text-destructive text-title-1 mb-4">Access denied</h1>
        <p className="text-label-secondary text-body mb-6">
          You do not have permission to view the Administration console.
        </p>
        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </Button>
          <Button asChild>
            <Link href="/">Go to home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const { user, isLoaded } = useUser();
  const { user: permissionUser, isLoading: permissionsLoading } = usePermissions();
  const pathname = usePathname();

  if (!isLoaded || permissionsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div
            aria-hidden
            className="border-tint mx-auto mb-4 size-12 animate-spin rounded-full border-b-2 motion-reduce:animate-none"
          />
          <p className="text-label-secondary">Loading...</p>
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
    (typeof user?.publicMetadata?.role === "string" &&
      allowedRoles.has(user.publicMetadata.role)) ||
    (typeof permissionUser?.role?.name === "string" && allowedRoles.has(permissionUser.role.name));

  if (!isSystemOwnerUser && !hasAdminRole) {
    return <AccessDeniedScreen />;
  }

  if (pathname === "/admin/maps/editor" || pathname === "/admin/maps/style-editor") {
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

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div data-app="admin" className="contents">
      <PortalTintSync />
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </div>
  );
}
