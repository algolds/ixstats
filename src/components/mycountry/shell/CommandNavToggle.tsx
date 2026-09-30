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
import { Button } from "~/components/ui/button";
import { FacetContainer } from "~/components/ui/facet-container";
import { withBasePath, stripBasePath } from "~/lib/base-path";
import { MyCountryLogo } from "~/components/mycountry/shared/primitives/mycountry-logo";
import { useTheme } from "~/context/theme-context";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import type { CountryWithEconomicData } from "~/components/mycountry/shared/primitives/CountryDataProvider";

export type CommandNavMode = "home" | "executive";
export type V2Mode = CommandNavMode;

export function CommandNavToggle({
  mode = "home",
  onChangeMode,
}: {
  mode?: CommandNavMode;
  activeSection?: string;
  onChangeMode?: (mode: CommandNavMode) => void;
  onNavigate?: (section: string) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { compactMode } = useTheme();
  const rawPath = stripBasePath(pathname ?? "");

  const mainNav: { id: V2Mode; label: string; icon: typeof LayoutGrid }[] = [
    { id: "home", label: "Home", icon: LayoutGrid },
    { id: "executive", label: "Declare a Directive", icon: Command },
  ];

  const isHomeSection =
    rawPath === "/mycountry" || rawPath === "/mycountry/v2" || rawPath === "/mycountry/";

  return (
    <FacetContainer
      depth={1}
      interactive="none"
      enableRefraction={false}
      className="flex w-fit flex-wrap items-center gap-1.5 rounded-xl p-1"
    >
      {/* Official MyCountry Brand Logo Pill */}
      <div className="border-border flex shrink-0 items-center gap-2 border-r px-2 py-0.5">
        <MyCountryLogo size="sm" variant="full" animated={true} />
      </div>
      {/* Primary operating modes */}
      {mainNav.map(({ id, label, icon: Icon }) => {
        const active = isHomeSection && mode === id;
        return (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={active}
            onClick={() => {
              if (!isHomeSection) {
                router.push(withBasePath("/mycountry"));
              }
              if (onChangeMode) {
                onChangeMode(id);
              }
            }}
            className={cn(
              "gap-1.5 font-semibold",
              compactMode ? "h-7 px-3" : "h-8 px-3.5",
              active ? "bg-accent text-foreground" : "text-muted-foreground"
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn("size-3.5", active && id === "executive" && "text-(--facet-mycountry)")}
            />
            {label}
          </Button>
        );
      })}
    </FacetContainer>
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
  country?: CountryWithEconomicData | null;
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
    },
    {
      id: "editor" as const,
      href: editorHref,
      label: "Editor",
      icon: Edit3,
    },
  ];

  return (
    <FacetContainer
      depth={1}
      interactive="none"
      enableRefraction={false}
      className="flex w-fit shrink-0 items-center gap-1.5 rounded-xl p-1"
    >
      {navItems.map(({ id, href, label, icon: Icon }, idx) => {
        const active =
          rawPath.startsWith(href) ||
          (id === "editor" &&
            (rawPath.startsWith("/mycountry/editor") ||
              rawPath.startsWith("/mycountry/map-editor")));
        return (
          <React.Fragment key={href}>
            {idx > 0 && <div aria-hidden="true" className="bg-border mx-0.5 h-4 w-px shrink-0" />}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (id === "editor" && onNavigate) {
                  onNavigate("map-editor");
                } else {
                  router.push(withBasePath(href));
                }
              }}
              className={cn(
                "gap-1.5 font-semibold",
                compactMode ? "h-7 px-3" : "h-8 px-3.5",
                active ? "bg-accent text-foreground" : "text-muted-foreground"
              )}
            >
              <Icon aria-hidden="true" className="size-3.5" />
              <span>{label}</span>
            </Button>
          </React.Fragment>
        );
      })}
    </FacetContainer>
  );
}

export const V2ModeToggle = CommandNavToggle;
export const V2RightPillNav = CommandRightPillNav;
