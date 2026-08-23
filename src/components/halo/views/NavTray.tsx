"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { StatsReport as BarChart3, Compass, Crown, Globe, ChatBubble as MessageSquare, MoreHoriz as MoreHorizontal } from "iconoir-react";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { stripBasePath } from "~/lib/base-path";
import { PreText } from "~/components/ui/pretext";

// ─── Section color mapping (matches NAV_COLORS from navigation.tsx) ──────────
export const SECTION_COLORS: Record<string, { accent: string; bg: string; label: string }> = {
  "/dashboard": { accent: "#10b981", bg: "bg-emerald-500/15", label: "Dashboard" },
  "/mycountry": { accent: "#f59e0b", bg: "bg-amber-500/15", label: "MyCountry" },
  "/countries": { accent: "#8b5cf6", bg: "bg-purple-500/15", label: "Explore" },
  "/leaderboards": { accent: "#8b5cf6", bg: "bg-purple-500/15", label: "Explore" },
  "/maps": { accent: "#06b6d4", bg: "bg-cyan-500/15", label: "Maps" },
  "/w": { accent: "#3b82f6", bg: "bg-blue-500/15", label: "Wiki" },
  "/forum": { accent: "#f97316", bg: "bg-orange-500/15", label: "Forum" },
  "/vault": { accent: "#06b6d4", bg: "bg-cyan-500/15", label: "Cards" },
  "/thinkpages": { accent: "#3b82f6", bg: "bg-blue-500/15", label: "ThinkPages" },
  "/admin": { accent: "#ef4444", bg: "bg-red-500/15", label: "Admin" },
  "/feed": { accent: "#8b5cf6", bg: "bg-purple-500/15", label: "Feed" },
};

export function getSectionForPath(pathname: string): { accent: string; bg: string; label: string } {
  const normalized = stripBasePath(pathname || "/");
  // Find longest matching prefix
  let match = { accent: "#3b82f6", bg: "bg-blue-500/15", label: "IxStats" };
  let maxLen = 0;
  for (const [prefix, section] of Object.entries(SECTION_COLORS)) {
    if (normalized.startsWith(prefix) && prefix.length > maxLen) {
      match = section;
      maxLen = prefix.length;
    }
  }
  return match;
}

// ─── Primary nav items for the tray ──────────────────────────────────────────

interface NavTrayItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const PRIMARY_NAV: NavTrayItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3, accent: "#10b981" },
  { name: "MyCountry", href: "/mycountry", icon: Crown, accent: "#f59e0b" },
  { name: "Explore", href: "/countries", icon: Globe, accent: "#8b5cf6" },
  { name: "Wiki", href: "/w", icon: WikiOSLogomark, accent: "#3b82f6" },
  { name: "Maps", href: "/maps", icon: Compass, accent: "#06b6d4" },
  { name: "Forum", href: "/forum", icon: MessageSquare, accent: "#f97316" },
];

const SECONDARY_NAV: { name: string; href: string }[] = [
  { name: "Cards", href: "/vault" },
  { name: "Labs", href: "/labs/onoma" },
  { name: "Help", href: "/help" },
];

// ─── NavTray Component ───────────────────────────────────────────────────────

export interface NavTrayProps {
  isOpen: boolean;
  onClose: () => void;
}

function NavTrayComponent({ isOpen, onClose }: NavTrayProps) {
  const pathname = usePathname();
  const normalized = stripBasePath(pathname || "/");

  const isActive = (href: string) => {
    const clean = href.split("?")[0].split("#")[0] || "/";
    if (normalized === clean) return true;
    return clean !== "/" && normalized.startsWith(`${clean}/`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="nav-tray-backdrop"
            className="pointer-events-auto fixed inset-0 z-[9998]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Tray */}
          <motion.div
            key="nav-tray"
            className="pointer-events-auto absolute top-full left-1/2 z-[10001] mt-3 w-[280px] -translate-x-1/2"
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }}
          >
            <div
              className="overflow-hidden rounded-2xl border border-white/20 shadow-2xl dark:border-white/10"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
                backdropFilter: "blur(24px) saturate(180%)",
                WebkitBackdropFilter: "blur(24px) saturate(180%)",
              }}
            >
              {/* Refraction edges */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              </div>

              {/* Primary nav grid */}
              <div className="relative z-10 grid grid-cols-2 gap-1.5 p-2.5">
                {PRIMARY_NAV.map((item, i) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <motion.div
                      key={item.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 38,
                        mass: 0.8,
                        delay: i * 0.03,
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={onClose}
                        data-cuelume-hover="tick"
                        data-cuelume-press="press"
                        className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                          active
                            ? "bg-foreground/10 text-foreground shadow-sm"
                            : "text-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${
                            active ? "shadow-sm" : "bg-foreground/5 group-hover:bg-foreground/10"
                          }`}
                          style={active ? { backgroundColor: `${item.accent}30` } : undefined}
                        >
                          <div
                            className="flex items-center justify-center"
                            style={active ? { color: item.accent } : undefined}
                          >
                            <Icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                          </div>
                        </div>
                        <PreText className="text-xs font-medium" whiteSpace="nowrap">
                          {item.name}
                        </PreText>
                        {active && (
                          <div
                            className="ml-auto h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: item.accent }}
                          />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* Secondary nav — compact row */}
              <div className="border-border relative z-10 border-t px-3 py-2">
                <div className="flex items-center gap-1">
                  <MoreHorizontal className="text-foreground/30 mr-1 h-3 w-3" />
                  {SECONDARY_NAV.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      data-cuelume-hover="tick"
                      data-cuelume-press="press"
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                        isActive(item.href)
                          ? "bg-foreground/10 text-foreground"
                          : "text-foreground/50 hover:bg-foreground/5 hover:text-foreground/80"
                      }`}
                    >
                      <PreText className="text-inherit" whiteSpace="nowrap">
                        {item.name}
                      </PreText>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export const NavTray = React.memo(NavTrayComponent);
