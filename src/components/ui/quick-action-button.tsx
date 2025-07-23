import React from "react";
import Link from "next/link";

interface QuickActionButtonProps {
  href: string;
  icon: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function QuickActionButton({ href, icon, children, size = 'md' }: QuickActionButtonProps) {
  const sizeClasses = {
    sm: 'p-2 text-xs',
    md: 'p-4 text-sm',
    lg: 'p-6 text-base'
  };
  
  const iconSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };
  
  return (
    <Link
      href={href}
      className={`glass-button ${sizeClasses[size]} rounded-lg hover:scale-105 transition-all cursor-pointer block text-center space-y-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]`}
    >
      <div className={`${iconSizes[size]}`} aria-hidden="true">{icon}</div>
      <div className={`${sizeClasses[size].includes('text-xs') ? 'text-xs' : sizeClasses[size].includes('text-base') ? 'text-base' : 'text-sm'} font-medium text-[var(--color-text-primary)]`}>
        {children}
      </div>
    </Link>
  );
} 