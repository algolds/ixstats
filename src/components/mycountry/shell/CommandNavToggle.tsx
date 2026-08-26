"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ViewGrid as LayoutGrid,
  KeyCommand as Command,
  User,
  EditPencil as Edit3,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { withBasePath, stripBasePath } from "~/lib/base-path";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { useTheme } from "~/context/theme-context";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";
import { useCountryData } from "~/components/mycountry/shared/primitives";

export type CommandNavMode = "home" | "executive";
export type V2Mode = CommandNavMode;

export function CommandNavToggle({
  mode = "home",
  // oxlint-disable-next-line eslint/no-unused-vars
  activeSection = "overview",
  onChangeMode,
  // oxlint-disable-next-line eslint/no-unused-vars
  onNavigate,
}: {
  mode?: CommandNavMode;
  activeSection?: string;
  onChangeMode?: (mode: CommandNavMode) => void;
  onNavigate?: (section: any) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { compactMode } = useTheme();
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
      id: "executive",
      label: "Declare a Directive",
      icon: Command,
      activeCls: "border-amber-500/30 bg-amber-500/20 text-amber-400 shadow-sm",
      hoverCls: "hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20",
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
              "text-muted-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent font-semibold transition-all select-none active:scale-[0.98]",
              compactMode ? "px-3 py-1.25 text-xs" : "px-3.5 py-1.5 text-xs",
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
export function CommandRightPillNav({
  country,
  onNavigate,
}: {
  country?: any;
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { compactMode } = useTheme();
  const rawPath = stripBasePath(pathname ?? "");
  const { country: ctxCountry } = useCountryData();
  const activeCountry = country ?? ctxCountry;

  const publicProfileHref = activeCountry?.slug
    ? `/countries/${activeCountry.slug}`
    : activeCountry?.id
      ? `/countries/${activeCountry.id}`
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
                "text-muted-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent font-semibold transition-all select-none active:scale-95",
                compactMode ? "px-3 py-1.25 text-xs" : "px-3.5 py-1.5 text-xs",
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

export const V2ModeToggle = CommandNavToggle;
export const V2RightPillNav = CommandRightPillNav;
