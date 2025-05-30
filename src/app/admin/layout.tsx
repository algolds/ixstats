// src/app/admin/layout.tsx (or create a wrapper)
"use client";

import { AdminErrorBoundary } from "./_components/ErrorBoundary";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <AdminErrorBoundary>
      {children}
    </AdminErrorBoundary>
  );
}

export function AdminDashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AdminErrorBoundary>
      <div className="admin-dashboard">
        {children}
      </div>
    </AdminErrorBoundary>
  );
}