import React from "react";
import Link from "next/link";

interface QuickActionButtonProps {
  href: string;
  icon: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function QuickActionButton({ href, icon, children, size = "md" }: QuickActionButtonProps) {
  const sizeClasses = {
    sm: "p-2 text-xs",
    md: "p-4 text-sm",
    lg: "p-6 text-base",
  };

  const iconSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <Link
      href={href}
      className={`glass-button ${sizeClasses[size]} block cursor-pointer space-y-2 rounded-lg text-center transition-all hover:scale-105 focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:outline-none`}
    >
      <div className={`${iconSizes[size]}`} aria-hidden="true">
        {icon}
      </div>
      <div
        className={`${sizeClasses[size].includes("text-xs") ? "text-xs" : sizeClasses[size].includes("text-base") ? "text-base" : "text-sm"} font-medium text-[var(--color-text-primary)]`}
      >
        {children}
      </div>
    </Link>
  );
}
