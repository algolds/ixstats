import React, { useState } from "react";
import { GlassCard } from "./enhanced-card";
import { cn } from "~/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Shield,
  User,
  LogOut,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  Bell,
} from "lucide-react";
import { InterfaceSwitcher } from "../shared/InterfaceSwitcher";
import { Button } from "./button";
import { Badge } from "./badge";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../../trpc/react";
import { useUser, UserButton } from "~/context/auth-context";
import { createUrl } from "~/lib/url-utils";

interface Notification {
  id: string;
  title: string;
  description?: string;
  read?: boolean;
  href?: string;
}

interface UnifiedSidebarProps {
  current: "sdi" | "eci";
  profile?: {
    name?: string;
    role?: string;
    avatarUrl?: string | null;
    email?: string;
  };
  countryId?: string;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileOpen?: () => void;
  onMobileClose?: () => void;
  links?: Array<{
    key: string;
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: string | number;
  }>;
  activeKey?: string;
  notifications?: Notification[];
  unreadCount?: number;
  onNav?: (key: string) => void; // <-- add this
}

function getInitials(name?: string) {
  if (!name || typeof name !== "string") return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]?.[0] ? parts[0][0].toUpperCase() : "?";
  const first = parts[0]?.[0] ? parts[0][0].toUpperCase() : "";
  const second = parts[1]?.[0] ? parts[1][0].toUpperCase() : "";
  return first + second;
}

export function UnifiedSidebar({
  current,
  profile,
  countryId,
  collapsed = false,
  setCollapsed,
  mobileOpen = false,
  onMobileOpen,
  onMobileClose,
  links,
  activeKey,
  onNav,
  // Remove notifications and unreadCount props, will fetch in component
}: UnifiedSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  // Fetch notifications and unread count from backend
  const { data: notificationsData } = api.unifiedIntelligence.getIntelligenceFeed?.useQuery?.(
    { countryId: countryId || "" },
    { enabled: !!countryId, refetchInterval: 10000 }
  ) || { data: undefined };
  const { data: unreadCount = 0 } = api.unifiedIntelligence.getIntelligenceFeed?.useQuery?.(
    { countryId: countryId || "" },
    {
      enabled: !!countryId,
      refetchInterval: 10000,
      select: (data: any) => data?.filter((n: any) => !n.read).length || 0,
    }
  ) || { data: 0 };
  // Determine activeKey from route if not provided
  let computedActiveKey = activeKey;
  if (!computedActiveKey && links && pathname) {
    const found = links.find(
      (link) => pathname === link.href || pathname.startsWith(link.href + "/")
    );
    computedActiveKey = found?.key;
  }

  // Local state for mobile toggle if not controlled
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobileOpen = typeof mobileOpen === "boolean" ? mobileOpen : mobileSidebarOpen;
  const handleMobileOpen = onMobileOpen || (() => setMobileSidebarOpen(true));
  const handleMobileClose = onMobileClose || (() => setMobileSidebarOpen(false));

  // Local state for collapse if not controlled
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const isCollapsed = typeof setCollapsed === "function" ? collapsed : localCollapsed;
  const handleCollapse = () => {
    if (setCollapsed) setCollapsed(!collapsed);
    else setLocalCollapsed((c) => !c);
  };

  // Notification popover state
  const [showNotifications, setShowNotifications] = useState(false);

  // Sidebar content
  const sidebarContent = (
    <GlassCard
      variant="glass"
      className={cn(
        "flex h-full w-64 max-w-[320px] min-w-[220px] flex-col justify-between border-none bg-white/95 p-4 shadow-xl transition-all duration-300 dark:bg-neutral-900/95",
        isCollapsed && "w-20 max-w-[80px] min-w-[60px] p-2"
      )}
    >
      {/* Top: Collapse/Expand and Notifications */}
      <div className="relative mb-2 flex items-center justify-between">
        {!isCollapsed && (
          <span className="text-lg font-bold tracking-wide">
            {current === "sdi" ? "Sovereign Digital Interface" : "Executive Command Interface"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Notification Bell */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative"
            onClick={() => setShowNotifications((v) => !v)}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
          {/* Notification Popover - always within sidebar frame */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.18 }}
                className="fixed right-0 left-0 z-[10002] mx-auto w-72 max-w-[90vw] rounded-xl border border-blue-200 bg-white p-3 shadow-lg dark:border-blue-800 dark:bg-neutral-900"
                style={{ top: 70 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-2 font-semibold text-blue-900 dark:text-blue-100">
                  Notifications
                </div>
                {(!notificationsData?.items || notificationsData.items.length === 0) && (
                  <div className="text-muted-foreground py-6 text-center text-sm">
                    No notifications
                  </div>
                )}
                {(notificationsData?.items || []).slice(0, 6).map((n: any) => (
                  <Link
                    key={n.id}
                    href={n.href || "#"}
                    className={cn(
                      "block rounded-md px-2 py-2 text-sm transition-colors",
                      n.read
                        ? "text-gray-500 dark:text-gray-400"
                        : "bg-blue-50 font-semibold text-blue-900 dark:bg-blue-900/20 dark:text-blue-100"
                    )}
                    onClick={() => setShowNotifications(false)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate">{n.title}</span>
                      {!n.read && <span className="ml-2 h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    {n.description && (
                      <div className="text-muted-foreground mt-0.5 text-xs">{n.description}</div>
                    )}
                  </Link>
                ))}
                <div
                  className="mt-2 cursor-pointer text-center text-xs text-blue-500 hover:underline"
                  onClick={() => {
                    setShowNotifications(false);
                    router.push(createUrl("/notifications"));
                  }}
                >
                  View all
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Collapse/Expand Button (Desktop) */}
          <Button
            variant="ghost"
            size="icon"
            className="ml-1"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={handleCollapse}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
      {/* Top: Navigation */}
      <nav className="mt-2 flex flex-col gap-2">
        {(links || []).map((link) => (
          <button
            key={link.key}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-medium transition-all hover:bg-blue-500/10 hover:text-blue-600",
              computedActiveKey === link.key
                ? "border border-blue-400/30 bg-blue-500/20 font-semibold text-blue-700 shadow-lg dark:text-blue-200"
                : "text-neutral-700 dark:text-neutral-200",
              isCollapsed && "justify-center px-2"
            )}
            tabIndex={0}
            onClick={() => (onNav ? onNav(link.key) : link.href && router.push(link.href))}
          >
            {link.icon}
            {!isCollapsed && <span>{link.label}</span>}
            {link.badge && (
              <Badge className="ml-auto rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                {link.badge}
              </Badge>
            )}
          </button>
        ))}
      </nav>
      {/* Middle: SDI/ECI Switcher */}
      <div className={cn("mt-6 flex justify-center", isCollapsed && "mt-2")}>
        <InterfaceSwitcher currentInterface={current} countryId={countryId} />
      </div>
      {/* Bottom: Profile Info */}
      <div
        className={cn("mt-8 flex flex-col items-center gap-2", isCollapsed && "mt-4")}
        style={{ marginTop: "auto" }}
      >
        <div className="flex w-full items-center gap-3">
          {/* Avatar with UserButton overlayed in the shadow location */}
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-200 text-lg font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-200">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name || "User"}
                className="h-full w-full rounded-full object-cover"
              />
            ) : profile?.name ? (
              getInitials(profile.name)
            ) : null}
            {/* Clerk UserButton absolutely positioned over avatar shadow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { userButtonBox: "w-full h-full" } }}
              />
            </div>
          </div>
          {/* Name/role (hide if collapsed) */}
          {!isCollapsed && profile?.name && profile.role && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{profile.name}</span>
              <span className="truncate text-xs text-blue-500 dark:text-blue-300">
                {profile.role}
              </span>
            </div>
          )}
        </div>
        {/* User Menu: Profile/Settings/Logout */}
        <div
          className={cn(
            "mt-2 flex w-full flex-col justify-center gap-2",
            isCollapsed && "mt-1 items-center"
          )}
        >
          <Link
            href={createUrl("/profile")}
            className="flex items-center gap-2 text-sm text-blue-500 hover:underline dark:text-blue-300"
          >
            <Settings className="h-4 w-4" />
            {!isCollapsed && <span>Profile & Settings</span>}
          </Link>
        </div>
      </div>
    </GlassCard>
  );

  // Mobile slide-in
  return (
    <>
      {/* Mobile Hamburger Button */}
      <div className="fixed top-4 left-4 z-[9999] md:hidden">
        <Button variant="ghost" size="icon" aria-label="Open sidebar" onClick={handleMobileOpen}>
          <Menu className="h-6 w-6" />
        </Button>
      </div>
      {/* Desktop */}
      <aside className={cn("z-40 hidden h-screen md:flex")}>{sidebarContent}</aside>
      {/* Mobile */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-[9998] flex md:hidden"
            style={{ background: "rgba(16,24,40,0.25)", backdropFilter: "blur(8px)" }}
            onClick={handleMobileClose}
          >
            <div className="h-full w-64 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
              {sidebarContent}
            </div>
            {/* Click outside to close */}
            <div className="h-full flex-1" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
