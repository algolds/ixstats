// src/app/admin/layout.tsx
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