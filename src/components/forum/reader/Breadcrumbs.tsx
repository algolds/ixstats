"use client";
// src/components/forum/reader/Breadcrumbs.tsx
// Forum breadcrumb navigation.

import Link from "next/link";
import { NavArrowRight as ChevronRight } from "iconoir-react";
import { withBasePath } from "~/lib/base-path";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ForumBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function ForumBreadcrumbs({ items }: ForumBreadcrumbsProps) {
  const allItems: BreadcrumbItem[] = [{ label: "Forums", href: "/forum" }, ...items];

  return (
    <nav className="forum-breadcrumbs" aria-label="Breadcrumb">
      {allItems.map((item, idx) => (
        <span key={idx} className="flex items-center gap-1.5">
          {idx > 0 && <ChevronRight className="forum-breadcrumbs-separator h-3 w-3" />}
          {item.href && idx < allItems.length - 1 ? (
            <Link href={withBasePath(item.href)} className="hover:text-[var(--forum-accent)]">
              {item.label}
            </Link>
          ) : (
            <span className={idx === allItems.length - 1 ? "text-[var(--forum-text)]" : ""}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
