// src/app/admin/_components/AdminHeader.tsx
// Shared admin page header with title, description, and optional actions
"use client";

import type { LucideIcon } from "lucide-react";

interface AdminHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function AdminHeader({ icon: Icon, title, description, children }: AdminHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 border-primary/20 rounded-xl border p-2.5">
          <Icon className="text-primary h-6 w-6" />
        </div>
        <div>
          <h1 className="text-foreground text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
