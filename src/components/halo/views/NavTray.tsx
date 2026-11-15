"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { MoreHoriz as MoreHorizontal } from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { stripBasePath } from "~/lib/base-path";
import {
  getVisibleAppForPath,
  getVisibleApps,
  TAB_BAR_PRIORITY,
  type AppDefinition,
} from "~/lib/navigation/app-sections";
import { PreText } from "~/components/ui/pretext";
import { REDUCED_MOTION_FADE, springSmooth, tweenExit } from "~/lib/design/motion";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { FacetMaterial } from "~/components/ui/facet";
import { focusRing } from "~/components/ui/button";

/**
 * Splits visible non-footer sidebar apps into the 6 primary grid items and optional secondary row,
 * ordered by `TAB_BAR_PRIORITY`.
 */
export function splitNavTrayApps(visibleApps: readonly AppDefinition[]): {
  primary: AppDefinition[];
  secondary: AppDefinition[];
} {
  const byId = new Map<AppDefinition["id"], AppDefinition>();
  for (const app of visibleApps) {
    if (app.placement !== "footer") {
      byId.set(app.id, app);
    }
  }

  const ordered: AppDefinition[] = [];
  for (const id of TAB_BAR_PRIORITY) {
    const app = byId.get(id);
    if (app) ordered.push(app);
  }
  for (const app of byId.values()) {
    if (!ordered.includes(app)) ordered.push(app);
  }

  return {
    primary: ordered.slice(0, 6),
    secondary: ordered.slice(6),
  };
}

export interface NavTrayProps {
  isOpen: boolean;
  onClose: () => void;
  apps?: readonly AppDefinition[];
}

export function NavTray({ isOpen, onClose, apps }: NavTrayProps) {
  const pathname = usePathname();
  const normalized = stripBasePath(pathname || "/");
  const trayRef = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useFacetReducedMotion();
  const { user } = useUser();

  const trayApps = apps ?? getVisibleApps({ signedIn: Boolean(user), isAdmin: false });
  const { primary, secondary } = splitNavTrayApps(trayApps);
  const activeAppId = getVisibleAppForPath(normalized, trayApps)?.id;

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.nav
          key="nav-tray"
          ref={trayRef}
          aria-label="Quick navigation"
          className="z-popover pointer-events-auto absolute top-full left-1/2 mt-3 w-[280px] -translate-x-1/2"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={
            reduceMotion
              ? { opacity: 0, transition: REDUCED_MOTION_FADE }
              : { opacity: 0, y: -8, scale: 0.96, transition: tweenExit }
          }
          transition={reduceMotion ? REDUCED_MOTION_FADE : springSmooth}
        >
          {/* The island's expanded acrylic sheet. */}
          <FacetMaterial
            layer="chrome"
            data-expanded="true"
            className="rounded-card isolate overflow-hidden"
          >
            {/* Primary nav grid */}
            <div className="grid grid-cols-2 gap-1 p-2">
              {primary.map((item, i) => {
                const Icon = item.icon;
                const active = item.id === activeAppId;

                return (
                  <motion.div
                    key={item.id}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={
                      reduceMotion ? REDUCED_MOTION_FADE : { ...springSmooth, delay: i * 0.03 }
                    }
                  >
                    <Link
                      href={item.href}
                      data-app={item.tint}
                      onClick={onClose}
                      aria-current={active ? "page" : undefined}
                      className={`group rounded-row duration-fast flex items-center gap-2 px-3 py-2 transition-[color,background-color] ${focusRing} ${
                        active
                          ? "bg-fill-3 text-label"
                          : "text-label-secondary hover:bg-fill-4 hover:text-label"
                      }`}
                    >
                      <div
                        className={`rounded-control-sm duration-fast flex size-8 shrink-0 items-center justify-center transition-colors ${
                          active ? "" : "bg-fill-4 group-hover:bg-fill-3"
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
                          aria-hidden="true"
                          className="flex items-center justify-center"
                          style={active ? { color: "var(--tint)" } : undefined}
                        >
                          <Icon className="size-4" />
                        </div>
                      </div>
                      <PreText className="text-caption font-medium" whiteSpace="nowrap">
                        {item.label}
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

            {/* Secondary nav — compact row when >6 apps are visible */}
            {secondary.length > 0 && (
              <div className="border-separator border-t px-3 py-2">
                <div className="flex items-center gap-1">
                  <MoreHorizontal
                    className="text-label-secondary mr-1 size-3.5"
                    aria-hidden="true"
                  />
                  {secondary.map((item) => {
                    const active = item.id === activeAppId;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        data-app={item.tint}
                        onClick={onClose}
                        aria-current={active ? "page" : undefined}
                        className={`text-caption rounded-control-sm px-2 py-1 transition-colors ${focusRing} ${
                          active
                            ? "bg-fill-3 text-label"
                            : "text-label-secondary hover:bg-fill-4 hover:text-label"
                        }`}
                      >
                        <PreText className="text-inherit" whiteSpace="nowrap">
                          {item.label}
                        </PreText>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </FacetMaterial>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
