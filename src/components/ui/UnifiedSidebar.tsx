import React, { useState } from "react";
import { GlassCard } from "./enhanced-card";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Shield, User, LogOut, Settings, Menu, ChevronLeft, ChevronRight, Bell } from "lucide-react";
import { InterfaceSwitcher } from "../shared/InterfaceSwitcher";
import { Button } from "./button";
import { Badge } from "./badge";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../../trpc/react";
import { useUser } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
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
  links?: Array<{ key: string; label: string; href: string; icon: React.ReactNode; badge?: string | number }>;
  activeKey?: string;
  notifications?: Notification[];
  unreadCount?: number;
  onNav?: (key: string) => void; // <-- add this
}

function getInitials(name?: string) {
  if (!name || typeof name !== 'string') return "?";
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
  const { data: notificationsData = [] } = api.sdi.getNotifications?.useQuery?.(
    { userId: user?.id || "" },
    { enabled: !!user?.id, refetchInterval: 10000 }
  ) || { data: [] };
  const { data: unreadCount = 0 } = api.sdi.getUnreadNotifications?.useQuery?.(
    { userId: user?.id || "" },
    { enabled: !!user?.id, refetchInterval: 10000 }
  ) || { data: 0 };
  // Determine activeKey from route if not provided
  let computedActiveKey = activeKey;
  if (!computedActiveKey && links && pathname) {
    const found = links.find(link => pathname === link.href || pathname.startsWith(link.href + "/"));
    computedActiveKey = found?.key;
  }

  // Local state for mobile toggle if not controlled
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobileOpen = typeof mobileOpen === 'boolean' ? mobileOpen : mobileSidebarOpen;
  const handleMobileOpen = onMobileOpen || (() => setMobileSidebarOpen(true));
  const handleMobileClose = onMobileClose || (() => setMobileSidebarOpen(false));

  // Local state for collapse if not controlled
  const [localCollapsed, setLocalCollapsed] = useState(false);
  const isCollapsed = typeof setCollapsed === 'function' ? collapsed : localCollapsed;
  const handleCollapse = () => {
    if (setCollapsed) setCollapsed(!collapsed);
    else setLocalCollapsed(c => !c);
  };

  // Notification popover state
  const [showNotifications, setShowNotifications] = useState(false);

  // Sidebar content
  const sidebarContent = (
    <GlassCard
      variant="glass"
      className={cn(
        "h-full flex flex-col justify-between p-4 w-64 min-w-[220px] max-w-[320px] border-none shadow-xl bg-white/95 dark:bg-neutral-900/95 transition-all duration-300",
        isCollapsed && "w-20 min-w-[60px] max-w-[80px] p-2"
      )}
    >
      {/* Top: Collapse/Expand and Notifications */}
      <div className="flex items-center justify-between mb-2 relative">
        {!isCollapsed && <span className="font-bold text-lg tracking-wide">{current === 'sdi' ? 'Sovereign Digital Interface' : 'Executive Command Interface'}</span>}
        <div className="flex items-center gap-2 ml-auto">
          {/* Notification Bell */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="relative"
            onClick={() => setShowNotifications(v => !v)}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
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
                className="fixed left-0 right-0 mx-auto z-50 w-72 max-w-[90vw] bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-blue-200 dark:border-blue-800 p-3"
                style={{ top: 70 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Notifications</div>
                {notificationsData.length === 0 && (
                  <div className="text-sm text-muted-foreground py-6 text-center">No notifications</div>
                )}
                {notificationsData.slice(0, 6).map((n: any) => (
                  <Link
                    key={n.id}
                    href={n.href || '#'}
                    className={cn(
                      "block px-2 py-2 rounded-md transition-colors text-sm",
                      n.read ? "text-gray-500 dark:text-gray-400" : "bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 font-semibold"
                    )}
                    onClick={() => setShowNotifications(false)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate flex-1">{n.title}</span>
                      {!n.read && <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full" />}
                    </div>
                    {n.description && <div className="text-xs text-muted-foreground mt-0.5">{n.description}</div>}
                  </Link>
                ))}
                <div className="mt-2 text-xs text-blue-500 text-center cursor-pointer hover:underline" onClick={() => { setShowNotifications(false); router.push('/notifications'); }}>View all</div>
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
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </Button>
        </div>
      </div>
      {/* Top: Navigation */}
      <nav className="flex flex-col gap-2 mt-2">
        {(links || []).map((link) => (
          <button
            key={link.key}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 font-medium transition-all hover:bg-blue-500/10 hover:text-blue-600 w-full text-left",
              computedActiveKey === link.key
                ? "bg-blue-500/20 text-blue-700 dark:text-blue-200 font-semibold shadow-lg border border-blue-400/30"
                : "text-neutral-700 dark:text-neutral-200",
              isCollapsed && "justify-center px-2"
            )}
            tabIndex={0}
            onClick={() => onNav ? onNav(link.key) : (link.href && router.push(link.href))}
          >
            {link.icon}
            {!isCollapsed && <span>{link.label}</span>}
            {link.badge && (
              <Badge className="ml-auto bg-blue-500 text-white px-2 py-0.5 text-xs rounded-full">{link.badge}</Badge>
            )}
          </button>
        ))}
      </nav>
      {/* Middle: SDI/ECI Switcher */}
      <div className={cn("mt-6 flex justify-center", isCollapsed && "mt-2")}> 
        <InterfaceSwitcher currentInterface={current} countryId={countryId} />
      </div>
      {/* Bottom: Profile Info */}
      <div className={cn("mt-8 flex flex-col items-center gap-2", isCollapsed && "mt-4")}
        style={{ marginTop: "auto" }}
      >
        <div className="flex items-center gap-3 w-full">
          {/* Avatar with UserButton overlayed in the shadow location */}
          <div className="relative flex-shrink-0 w-10 h-10 rounded-full bg-blue-200 dark:bg-blue-900 flex items-center justify-center text-lg font-bold text-blue-700 dark:text-blue-200 overflow-hidden">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name || "User"}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              profile?.name ? getInitials(profile.name) : null
            )}
            {/* Clerk UserButton absolutely positioned over avatar shadow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonBox: "w-full h-full" } }} />
            </div>
          </div>
          {/* Name/role (hide if collapsed) */}
          {!isCollapsed && profile?.name && profile.role && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm truncate">{profile.name}</span>
              <span className="text-xs text-blue-500 dark:text-blue-300 truncate">{profile.role}</span>
            </div>
          )}
        </div>
        {/* User Menu: Profile/Settings/Logout */}
        <div className={cn("flex flex-col gap-2 w-full justify-center mt-2", isCollapsed && "items-center mt-1")}> 
          <Link href={createUrl("/profile")} className="flex items-center gap-2 text-blue-500 dark:text-blue-300 text-sm hover:underline">
            <Settings className="w-4 h-4" />
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
      <div className="md:hidden fixed top-4 left-4 z-[60]">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open sidebar"
          onClick={handleMobileOpen}
        >
          <Menu className="w-6 h-6" />
        </Button>
      </div>
      {/* Desktop */}
      <aside className={cn("hidden md:flex h-screen z-40")}>{sidebarContent}</aside>
      {/* Mobile */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ x: -320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -320, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex md:hidden"
            style={{ background: "rgba(16,24,40,0.25)", backdropFilter: "blur(8px)" }}
            onClick={handleMobileClose}
          >
            <div
              className="w-64 max-w-[90vw] h-full"
              onClick={e => e.stopPropagation()}
            >
              {sidebarContent}
            </div>
            {/* Click outside to close */}
            <div className="flex-1 h-full" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
} 