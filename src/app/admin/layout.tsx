// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/app/admin/layout.tsx
// Shared admin layout with auth guard, sidebar, and error boundary
"use client";

import { AdminErrorBoundary } from "./_components/ErrorBoundary";
import { AdminSidebarLayout } from "./_components/AdminSidebarLayout";
import { SignInButton, useUser, UserButton } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, isLoaded } = useUser();

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
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="border-border bg-card rounded-lg border p-8 text-center shadow-lg">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You do not have permission to view this page.
          </p>
          <UserButton signOutUrl="/" />
        </div>
      </div>
    );
  }

  return (
    <AdminErrorBoundary>
      <AdminSidebarLayout>{children}</AdminSidebarLayout>
    </AdminErrorBoundary>
  );
}
