"use client";

import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Command, Handshake, Shield, Scale, TrendingUp } from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath, stripBasePath } from "~/lib/base-path";

export type V2Mode = "home" | "console";

/**
 * Single Unified V2 Navigation Surface Pill:
 * [ Home | Declare a Directive | (sep) | Diplomacy | Defense | Politics | Economy ]
 *
 * Navigation behavior:
 *  - Operating Modes (Home / Declare a Directive): manage local V2 mode
 *  - Domain Links (Diplomacy, Defense, Politics, Economy): navigate to full standalone pages
 */
export function V2ModeToggle({
  mode = "home",
  onChangeMode,
}: {
  mode?: V2Mode;
  onChangeMode?: (mode: V2Mode) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const rawPath = stripBasePath(pathname ?? "");

  const mainNav: {
    id: V2Mode;
    label: string;
    icon: typeof LayoutGrid;
    activeCls: string;
    hoverCls: string;
  }[] = [
    {
      id: "home",
      label: "Home",
      icon: LayoutGrid,
      activeCls: "border-slate-400/30 bg-white/10 text-foreground shadow-sm",
      hoverCls: "hover:bg-white/5 hover:text-foreground",
    },
    {
      id: "console",
      label: "Declare a Directive",
      icon: Command,
      activeCls: "border-amber-500/30 bg-amber-500/20 text-amber-400 shadow-sm",
      hoverCls: "hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20",
    },
  ];

  const pageNav: {
    href: string;
    label: string;
    icon: typeof Handshake;
    activeCls: string;
    hoverCls: string;
  }[] = [
    {
      href: "/mycountry/diplomacy",
      label: "Diplomacy",
      icon: Handshake,
      activeCls: "bg-teal-500/20 text-teal-300 border-teal-500/30 shadow-sm",
      hoverCls: "hover:bg-teal-500/10 hover:text-teal-400 hover:border-teal-500/20",
    },
    {
      href: "/mycountry/defense",
      label: "Defense",
      icon: Shield,
      activeCls: "bg-red-500/20 text-red-300 border-red-500/30 shadow-sm",
      hoverCls: "hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20",
    },
    {
      href: "/mycountry/politics",
      label: "Politics",
      icon: Scale,
      activeCls: "bg-violet-500/20 text-violet-300 border-violet-500/30 shadow-sm",
      hoverCls: "hover:bg-violet-500/10 hover:text-violet-400 hover:border-violet-500/20",
    },
    {
      href: "/mycountry/executive",
      label: "Economy",
      icon: TrendingUp,
      activeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm",
      hoverCls: "hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20",
    },
  ];

  const isHomeSection = rawPath === "/mycountry" || rawPath === "/mycountry/v2" || rawPath === "/mycountry/";

  return (
    <div className="border-border/60 bg-card/50 flex flex-wrap items-center gap-1 rounded-xl border p-1 backdrop-blur-md w-fit">
      {/* Primary operating modes */}
      {mainNav.map(({ id, label, icon: Icon, activeCls, hoverCls }) => {
        const active = isHomeSection && mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (!isHomeSection) {
                router.push(withBasePath("/mycountry"));
              }
              if (onChangeMode) {
                onChangeMode(id);
              }
            }}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all border border-transparent text-muted-foreground",
              active ? activeCls : hoverCls
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}

      {/* Subtle vertical divider */}
      <div className="mx-1 h-4 w-px shrink-0 bg-white/10" />

      {/* Full Page Navigation Links */}
      {pageNav.map(({ href, label, icon: Icon, activeCls, hoverCls }) => {
        const active = rawPath.startsWith(href);
        return (
          <button
            key={href}
            type="button"
            onClick={() => router.push(withBasePath(href))}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all border border-transparent text-muted-foreground",
              active ? activeCls : hoverCls
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}