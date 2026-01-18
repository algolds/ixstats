"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Package,
  ShoppingCart,
  Folder,
  Grid3x3,
  Download,
  X,
  Shield,
  Lock,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { VaultIcon } from "./VaultIcon";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
  badge?: number;
  badgeColor?: "purple" | "blue" | "green" | "gold" | "cyan";
  dividerAfter?: boolean;
  section?: "core" | "acquire" | "organize" | "import";
}

interface VaultNavigationProps {
  className?: string;
  onClose?: () => void;
  stats?: {
    unopenedPacks?: number;
    activeAuctions?: number;
  };
}

export function VaultNavigation({ className, onClose, stats }: VaultNavigationProps) {
  const pathname = usePathname();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      href: "/vault",
      icon: Home,
      section: "core",
    },
    {
      label: "Inventory",
      href: "/vault/inventory",
      icon: Grid3x3,
      section: "core",
      dividerAfter: true,
    },
    {
      label: "Packs",
      href: "/vault/packs",
      icon: Package,
      badge: stats?.unopenedPacks,
      badgeColor: "purple",
      section: "acquire",
    },
    {
      label: "Market",
      href: "/vault/market",
      icon: ShoppingCart,
      badge: stats?.activeAuctions,
      badgeColor: "blue",
      section: "acquire",
      dividerAfter: true,
    },
    {
      label: "Collections",
      href: "/vault/collections",
      icon: Folder,
      section: "organize",
    },
    {
      label: "Lore Gallery",
      href: "/vault/lore-gallery",
      icon: BookOpen,
      section: "organize",
      dividerAfter: true,
    },
    {
      label: "Import NS Deck",
      href: "/vault/import",
      icon: Download,
      section: "import",
      badgeColor: "cyan",
    },
  ];

  const securityLevel = 85; // Mock security level (can be dynamic)

  return (
    <nav
      className={cn(
        "flex flex-col h-full relative",
        "glass-hierarchy-parent vault-metallic-border rounded-r-2xl md:rounded-2xl",
        "vault-bg-pattern overflow-hidden",
        className
      )}
    >
      {/* Top Security Status Indicator */}
      <div className="p-4 border-b vault-metallic-border">
        {/* Close button for mobile drawer (top right) */}
        {onClose && (
          <div className="flex items-center justify-between mb-3 md:hidden">
            <VaultIcon size="sm" animated />
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <motion.div
          className="flex items-center gap-3 rounded-lg bg-black/40 backdrop-blur-md p-3 vault-glow-gold"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Lock className="h-5 w-5 text-gold-400" />
          </motion.div>
          <div className="flex-1">
            <p className="text-xs font-bold text-gold-400 uppercase tracking-wide">Vault Secure</p>
            <div className="mt-1 h-1.5 rounded-full bg-black/60 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${securityLevel}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
          </div>
          <span className="text-xs font-black text-gold-400">{securityLevel}%</span>
        </motion.div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 p-4 space-y-1 overflow-y-auto hide-scrollbar">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          const isHovered = hoveredItem === item.href;
          const hasBadge = item.badge !== undefined && item.badge > 0;

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={onClose}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <motion.div
                  className={cn(
                    "group relative flex items-center gap-4 rounded-xl px-4 py-3.5 transition-all duration-200",
                    "glass-hierarchy-interactive overflow-hidden",
                    isActive && "vault-card-featured",
                    !isActive && "hover:vault-glow-purple"
                  )}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {/* Active indicator line */}
                  {isActive && (
                    <motion.div
                      className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-gold-400 to-purple-500 rounded-r-full"
                      layoutId="activeIndicator"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}

                  {/* Icon with animation */}
                  <motion.div
                    animate={{
                      rotate: isActive ? 360 : 0,
                      scale: isActive || isHovered ? 1.1 : 1,
                    }}
                    transition={{
                      rotate: { duration: 0.6, ease: "easeInOut" },
                      scale: { duration: 0.2 },
                    }}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6 transition-colors",
                        isActive
                          ? "text-gold-400"
                          : "text-white/60 group-hover:text-white"
                      )}
                    />
                  </motion.div>

                  {/* Label */}
                  <span
                    className={cn(
                      "flex-1 font-semibold transition-colors",
                      isActive ? "text-white" : "text-white/60 group-hover:text-white"
                    )}
                  >
                    {item.label}
                  </span>

                  {/* Floating Badge with 3D effect */}
                  <AnimatePresence>
                    {hasBadge && (
                      <motion.div
                        className={cn(
                          "flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-black text-white",
                          "shadow-2xl relative",
                          item.badgeColor === "purple" &&
                            "bg-gradient-to-br from-purple-400 to-purple-600 vault-glow-purple",
                          item.badgeColor === "blue" &&
                            "bg-gradient-to-br from-blue-400 to-blue-600",
                          item.badgeColor === "green" &&
                            "bg-gradient-to-br from-green-400 to-green-600",
                          item.badgeColor === "gold" &&
                            "bg-gradient-to-br from-gold-400 to-gold-600 vault-glow-gold",
                          item.badgeColor === "cyan" &&
                            "bg-gradient-to-br from-cyan-400 to-cyan-600 vault-glow-cyan"
                        )}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{
                          scale: 1,
                          rotate: 0,
                          y: [0, -2, 0],
                        }}
                        exit={{ scale: 0, rotate: 180 }}
                        transition={{
                          scale: { type: "spring", stiffness: 500, damping: 15 },
                          y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                        }}
                        whileHover={{ scale: 1.15 }}
                      >
                        {item.badge! > 99 ? "99+" : item.badge}
                        {/* Pulsing glow effect */}
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{
                            boxShadow: `0 0 20px ${
                              item.badgeColor === "purple"
                                ? "rgba(168, 85, 247, 0.6)"
                                : item.badgeColor === "blue"
                                ? "rgba(59, 130, 246, 0.6)"
                                : item.badgeColor === "gold"
                                ? "rgba(251, 191, 36, 0.6)"
                                : "rgba(34, 211, 238, 0.6)"
                            }`,
                          }}
                          animate={{
                            opacity: [0.5, 1, 0.5],
                            scale: [1, 1.2, 1],
                          }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Hover shimmer effect */}
                  {isHovered && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
                      }}
                    />
                  )}
                </motion.div>
              </Link>

              {/* Metallic Divider */}
              {item.dividerAfter && (
                <motion.div
                  className="my-3 h-px relative"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: index * 0.05 + 0.2 }}
                >
                  <div className="h-full bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-400/20 to-transparent blur-sm" />
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom IxCredits Mini Widget */}
      <motion.div
        className="p-4 border-t vault-metallic-border"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="rounded-lg bg-black/40 backdrop-blur-md p-3 vault-glow-gold">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-gold-400" />
            <span className="text-xs font-bold text-white/80">Quick Stats</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">IxCredits</span>
              <span className="text-sm font-black text-gold-400">
                {stats?.unopenedPacks ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/60">Today</span>
              <span className="text-xs font-semibold text-green-400">+125</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Background decorative elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-gold-400/5 rounded-full blur-2xl pointer-events-none" />
    </nav>
  );
}
