"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { StatsReport as BarChart3, MoreHoriz as MoreHorizontal } from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { MyCountryLogomark } from "~/lib/navigation/icons/MyCountryLogomark";
import { RealmsLogomark } from "~/lib/navigation/icons/RealmsLogomark";
import { Compass as SolidCompass, MultiBubble as SolidMultiBubble } from "iconoir-react/solid";
import { stripBasePath } from "~/lib/base-path";
import { PreText } from "~/components/ui/pretext";
import { springSmooth, tweenExit } from "~/lib/design/motion";
import { FacetMaterial } from "~/components/ui/facet";
import { focusRing } from "~/components/ui/button";

// Primary nav items for the tray

interface NavTrayItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The app's `data-app` tint; the item's accent is that scope's `--tint`. Omitted = the default tint. */
  app?: string;
}

const PRIMARY_NAV: NavTrayItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "MyCountry", href: "/mycountry", icon: MyCountryLogomark, app: "mycountry" },
  { name: "Realms", href: "/realms", icon: RealmsLogomark, app: "realms" },
  { name: "Wiki", href: "/w", icon: WikiOSLogomark, app: "wiki" },
  { name: "Maps", href: "/maps", icon: SolidCompass, app: "maps" },
  { name: "Forum", href: "/forum", icon: SolidMultiBubble, app: "forum" },
];

const SECONDARY_NAV: { name: string; href: string }[] = [
  { name: "Vault", href: "/vault" },
  { name: "Labs", href: "/labs/onoma" },
  { name: "Help", href: "/help" },
];

// NavTray Component

interface NavTrayProps {
  isOpen: boolean;
  onClose: () => void;
}

function NavTrayComponent({ isOpen, onClose }: NavTrayProps) {
  const pathname = usePathname();
  const normalized = stripBasePath(pathname || "/");
  const trayRef = React.useRef<HTMLDivElement>(null);

  // Close on an outside press or Escape.
  React.useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (trayRef.current && !trayRef.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const isActive = (href: string) => {
    const clean = href.split("?")[0].split("#")[0] || "/";
    if (normalized === clean) return true;
    return clean !== "/" && normalized.startsWith(`${clean}/`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.nav
          key="nav-tray"
          ref={trayRef}
          aria-label="Quick navigation"
          className="pointer-events-auto absolute top-full left-1/2 z-30 mt-3 w-[280px] -translate-x-1/2"
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96, transition: tweenExit }}
          transition={springSmooth}
        >
          {/* The island's expanded acrylic sheet. */}
          <FacetMaterial
            layer="chrome"
            data-expanded="true"
            className="rounded-card isolate overflow-hidden"
          >
            {/* Primary nav grid */}
            <div className="grid grid-cols-2 gap-1 p-2">
              {PRIMARY_NAV.map((item, i) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springSmooth, delay: i * 0.03 }}
                  >
                    <Link
                      href={item.href}
                      data-app={item.app}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`group rounded-row flex items-center gap-2 px-3 py-2 transition-[color,background-color,box-shadow] duration-200 ${focusRing} ${
                        active
                          ? "bg-fill-3 text-label shadow-card"
                          : "text-label-secondary hover:bg-fill-4 hover:text-label"
                      }`}
                    >
                      <div
                        className={`rounded-control-sm flex size-8 shrink-0 items-center justify-center transition-colors duration-150 ${
                          active ? "shadow-card" : "bg-fill-4 group-hover:bg-fill-3"
                        }`}
                        style={
                          active
                            ? {
                                backgroundColor: "color-mix(in srgb, var(--tint) 19%, transparent)",
                              }
                            : undefined
                        }
                      >
                        <div
                          className="flex items-center justify-center"
                          style={active ? { color: "var(--tint)" } : undefined}
                        >
                          <Icon className="size-4 transition-[scale] duration-200 motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110" />
                        </div>
                      </div>
                      <PreText className="text-caption font-medium" whiteSpace="nowrap">
                        {item.name}
                      </PreText>
                      {active && (
                        <div
                          aria-hidden="true"
                          className="ml-auto size-1.5 rounded-full"
                          style={{ backgroundColor: "var(--tint)" }}
                        />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Secondary nav — compact row */}
            <div className="border-separator border-t px-3 py-2">
              <div className="flex items-center gap-1">
                <MoreHorizontal className="text-label-secondary mr-1 size-3.5" aria-hidden="true" />
                {SECONDARY_NAV.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`text-caption rounded-control-sm px-2 py-1 transition-colors ${focusRing} ${
                      isActive(item.href)
                        ? "bg-fill-3 text-label"
                        : "text-label-secondary hover:bg-fill-4 hover:text-label"
                    }`}
                  >
                    <PreText className="text-inherit" whiteSpace="nowrap">
                      {item.name}
                    </PreText>
                  </Link>
                ))}
              </div>
            </div>
          </FacetMaterial>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

export const NavTray = React.memo(NavTrayComponent);
