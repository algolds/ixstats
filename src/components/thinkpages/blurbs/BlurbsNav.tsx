"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, User, PenLine } from "lucide-react";
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
    <nav className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
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
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "text-foreground bg-white/10"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
