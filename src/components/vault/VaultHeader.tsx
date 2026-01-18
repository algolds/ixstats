"use client";

import { useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, Search, Coins, Bell, TrendingUp, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { UserButton } from "@clerk/nextjs";
import { VaultIcon } from "./VaultIcon";
import NumberFlow from "~/components/ui/number-flow";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "~/lib/utils";

interface VaultHeaderProps {
  balance?: number;
  loading?: boolean;
  todayEarnings?: number;
  notificationCount?: number;
  onRefresh?: () => void;
  onMenuClick?: () => void;
}

export function VaultHeader({
  balance = 0,
  loading = false,
  todayEarnings = 0,
  notificationCount = 0,
  onRefresh,
  onMenuClick,
}: VaultHeaderProps) {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();
  const { scrollY } = useScroll();

  // Scroll-based effects
  const headerShadow = useTransform(
    scrollY,
    [0, 50],
    ["0px 0px 0px rgba(147, 51, 234, 0)", "0px 4px 20px rgba(147, 51, 234, 0.3)"]
  );
  const headerBlur = useTransform(scrollY, [0, 50], [12, 20]);

  // Generate breadcrumb from pathname
  const breadcrumbs = pathname
    ? pathname
        .split("/")
        .filter(Boolean)
        .map((segment, index, arr) => ({
          label: segment.charAt(0).toUpperCase() + segment.slice(1),
          href: "/" + arr.slice(0, index + 1).join("/"),
          isLast: index === arr.length - 1,
        }))
    : [];

  return (
    <motion.header
      className="sticky top-0 z-[9000] border-b border-border/40"
      style={{
        boxShadow: headerShadow as any,
        backdropFilter: `blur(${headerBlur}px)` as any,
        background: "linear-gradient(135deg, rgba(0, 0, 0, 0.85), rgba(147, 51, 234, 0.1))",
      }}
    >
      <div className="flex h-16 items-center justify-between px-4 md:px-6 relative">
        {/* Animated background glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-30"
          animate={{
            background: [
              "radial-gradient(circle at 0% 50%, rgba(147, 51, 234, 0.2) 0%, transparent 50%)",
              "radial-gradient(circle at 100% 50%, rgba(255, 215, 0, 0.2) 0%, transparent 50%)",
              "radial-gradient(circle at 0% 50%, rgba(147, 51, 234, 0.2) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />

        {/* Left section - Menu, Logo & Breadcrumb */}
        <div className="flex items-center gap-3 relative z-10">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden glass-hierarchy-interactive"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo/Title with animation */}
          <Link href="/vault" className="flex items-center gap-2 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <VaultIcon size="sm" animated />
            </motion.div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-bold text-white">MyVault</span>
              <motion.div
                className="h-1 w-1 rounded-full bg-gold-400"
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </Link>

          {/* Breadcrumb navigation (desktop) */}
          {breadcrumbs.length > 1 && (
            <nav className="hidden md:flex items-center gap-2 ml-2" aria-label="Breadcrumb">
              {breadcrumbs.slice(1).map((crumb, index) => (
                <div key={crumb.href} className="flex items-center gap-2">
                  <span className="text-white/40">/</span>
                  <Link
                    href={crumb.href}
                    className={cn(
                      "text-sm transition-colors",
                      crumb.isLast
                        ? "text-gold-400 font-semibold"
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    {crumb.label}
                  </Link>
                </div>
              ))}
            </nav>
          )}
        </div>

        {/* Center section - Expandable Search */}
        <div className="flex-1 max-w-2xl mx-4 hidden lg:flex justify-center relative z-10">
          <motion.div
            className="relative w-full max-w-md"
            animate={{ width: searchExpanded ? "100%" : "320px" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchExpanded(true)}
                onBlur={() => {
                  if (!searchQuery) setSearchExpanded(false);
                }}
                placeholder="Search cards, packs, collections..."
                className={cn(
                  "w-full pl-10 pr-4 py-2 rounded-lg",
                  "bg-black/40 border border-white/20 backdrop-blur-md",
                  "text-white placeholder-white/40",
                  "focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20",
                  "transition-all duration-200"
                )}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchExpanded(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Quick filters dropdown (shown when search is focused/expanded) */}
            {searchExpanded && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 p-2 rounded-lg bg-black/90 backdrop-blur-xl border border-white/20 shadow-2xl"
              >
                <div className="flex flex-wrap gap-2">
                  {["Cards", "Packs", "Collections", "Market"].map((filter) => (
                    <button
                      key={filter}
                      className="px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Right section - Balance, Notifications & User */}
        <div className="flex items-center gap-3 relative z-10">
          {/* IxCredits balance with mini chart */}
          <motion.div
            className="flex items-center gap-3 rounded-lg border border-gold-400/30 bg-black/40 backdrop-blur-md px-4 py-2 vault-glow-gold"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Coins className="h-5 w-5 text-gold-400" />
            </motion.div>

            {loading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <NumberFlow
                    value={balance}
                    format="compact"
                    className="text-xl font-black text-gold-400 tabular-nums"
                  />
                  <span className="text-xs text-white/60">IxC</span>
                </div>
                {todayEarnings > 0 && (
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <TrendingUp className="h-3 w-3" />
                    <span>+{todayEarnings.toLocaleString()} today</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Notifications bell */}
          <motion.div className="relative" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="icon"
              className="relative glass-hierarchy-interactive"
            >
              <Bell className="h-5 w-5 text-white/80" />
              {notificationCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold"
                >
                  {notificationCount > 9 ? "9+" : notificationCount}
                </motion.div>
              )}
            </Button>
          </motion.div>

          {/* User profile */}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Mobile search (shown on mobile devices) */}
      <div className="lg:hidden px-4 pb-3 relative z-10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-black/40 border border-white/20 backdrop-blur-md text-white placeholder-white/40 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>
      </div>
    </motion.header>
  );
}
