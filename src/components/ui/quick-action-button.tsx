import React from "react";
import Link from "next/link";

interface QuickActionButtonProps {
  href: string;
  icon: string;
  children: React.ReactNode;
}

export function QuickActionButton({ href, icon, children }: QuickActionButtonProps) {
  return (
    <Link
      href={href}
      className="glass-button p-4 rounded-lg hover:scale-105 transition-all cursor-pointer block text-center space-y-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]"
    >
      <div className="text-2xl" aria-hidden="true">{icon}</div>
      <div className="text-sm font-medium text-[var(--color-text-primary)]">
        {children}
      </div>
    </Link>
  );
} 