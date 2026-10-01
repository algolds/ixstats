"use client";
// src/app/admin/_components/AdminHeader.tsx
// Shared admin page header with title, description, and optional actions

interface AdminHeaderProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function AdminHeader({ icon: Icon, title, description, children }: AdminHeaderProps) {
  return (
    <div className="border-separator mb-8 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="bg-tint-fill text-tint rounded-row border-separator border p-3 shadow-xs transition-transform duration-300 motion-safe:hover:scale-105"
        >
          <Icon className="size-6" />
        </div>
        <div>
          <h1 className="text-large-title text-label">{title}</h1>
          {description && <p className="text-callout text-label-secondary mt-0.5">{description}</p>}
        </div>
      </div>
      {children && <div className="mt-2 flex items-center gap-2 sm:mt-0">{children}</div>}
    </div>
  );
}
