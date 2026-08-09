"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Command,
  Handshake,
  Shield,
  Scale,
  TrendingUp,
  User,
  Edit3,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath, stripBasePath } from "~/lib/base-path";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import type { MyCountrySection } from "../MyCountrySidebarNav";
import { useCountryData } from "../primitives";

export type V2Mode = "home" | "console";

/**
 * Single Unified V2 Navigation Surface Pill:
 * [ MyCountry Logo | Home | Declare a Directive | (sep) | Diplomacy | Defense | Politics | Economy ]
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
      href: "/mycountry/economy",
      label: "Economy",
      icon: TrendingUp,
      activeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-sm",
      hoverCls: "hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20",
    },
  ];

  const isHomeSection =
    rawPath === "/mycountry" || rawPath === "/mycountry/v2" || rawPath === "/mycountry/";

  return (
    <div className="border-border/60 bg-card/50 flex w-fit flex-wrap items-center gap-1.5 rounded-xl border p-1 backdrop-blur-md">
      {/* Official MyCountry Brand Logo Pill */}
      <div className="flex shrink-0 items-center gap-2 border-r border-white/10 px-2 py-0.5">
        <MyCountryLogo size="sm" variant="full" animated={true} />
      </div>
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
              "text-muted-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-3.5 py-1.5 text-xs font-semibold transition-all",
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
              "text-muted-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold transition-all",
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

/**
 * Mirrored Right Navigation Surface Pill:
 * [ Profile (Public Country Profile) | (sep) | Editor (/mycountry/editor) ]
 */
export function V2RightPillNav({
  onNavigate,
}: {
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const rawPath = stripBasePath(pathname ?? "");
  const { country } = useCountryData();

  const publicProfileHref = country?.slug
    ? `/countries/${country.slug}`
    : country?.id
      ? `/countries/${country.id}`
      : "/countries";

  const editorHref = "/mycountry/editor";

  const navItems = [
    {
      id: "profile" as const,
      href: publicProfileHref,
      label: "Profile",
      icon: User,
      activeCls: "bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-sm",
      hoverCls: "hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20",
    },
    {
      id: "editor" as const,
      href: editorHref,
      label: "Editor",
      icon: Edit3,
      activeCls: "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-sm",
      hoverCls: "hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20",
    },
  ];

  return (
    <div className="border-border/60 bg-card/50 flex w-fit shrink-0 items-center gap-1.5 rounded-xl border p-1 backdrop-blur-md">
      {navItems.map(({ id, href, label, icon: Icon, activeCls, hoverCls }, idx) => {
        const active =
          rawPath.startsWith(href) ||
          (id === "editor" &&
            (rawPath.startsWith("/mycountry/editor") ||
              rawPath.startsWith("/mycountry/map-editor")));
        return (
          <React.Fragment key={href}>
            {idx > 0 && <div className="mx-0.5 h-4 w-px shrink-0 bg-white/10" />}
            <button
              type="button"
              onClick={() => {
                if (id === "editor" && onNavigate) {
                  onNavigate("map-editor");
                } else {
                  router.push(withBasePath(href));
                }
              }}
              className={cn(
                "text-muted-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-3.5 py-1.5 text-xs font-semibold transition-all select-none active:scale-95",
                active ? activeCls : hoverCls
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
