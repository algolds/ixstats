"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OpenBook as BookOpen, User, EditPencil as PenLine } from "iconoir-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { stripBasePath } from "~/lib/base-path";

const NAV_ITEMS = [
  { href: "/blurbs", icon: BookOpen, label: "Browse" },
  { href: "/blurbs/mine", icon: User, label: "My Blurbs" },
  { href: "/blurbs/submit", icon: PenLine, label: "Submit" },
] as const;

export function BlurbsNav() {
  const pathname = usePathname();
  const stripped = stripBasePath(pathname);

  return (
    <nav className="rounded-control border-separator bg-fill-4 flex gap-1 border p-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/blurbs"
            ? stripped === "/blurbs" ||
              (stripped.startsWith("/blurbs/") &&
                stripped !== "/blurbs/mine" &&
                stripped !== "/blurbs/submit")
            : stripped === item.href;

        return (
          <Link
            key={item.href}
            href={withBasePath(item.href)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-control-sm text-caption flex items-center gap-2 px-3 py-2 transition-colors",
              isActive
                ? "text-label bg-fill-3"
                : "text-label-secondary hover:text-label hover:bg-fill-3"
            )}
          >
            <item.icon className="size-3.5" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
