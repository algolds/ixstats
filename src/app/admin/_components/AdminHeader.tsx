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
    <div className="border-border/20 mb-8 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <div className="bg-primary/5 border-border/40 text-primary rounded-xl border p-2.5 shadow-sm transition-transform duration-300 hover:scale-105">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        </div>
      </div>
      {children && <div className="mt-2 flex items-center gap-2 sm:mt-0">{children}</div>}
    </div>
  );
}
