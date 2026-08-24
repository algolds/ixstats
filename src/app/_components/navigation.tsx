"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, Xmark as X } from "iconoir-react";
import { CommandPalette } from "~/components/halo";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useHasRoleLevel, useHasPermission } from "~/hooks/usePermissions";
import { usePremium } from "~/hooks/usePremium";
import { stripBasePath } from "~/lib/base-path";
import { useCountryFlag } from "~/hooks/useCountryFlags";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import { isStandaloneClient } from "~/lib/system/standalone-detection";

import { contextualMenus, getContextKey } from "~/lib/navigation-config";
import { useNavigationScroll } from "~/hooks/useNavigationScroll";
import { useResponsiveNav } from "~/hooks/useResponsiveNav";
import { useNavigationItems } from "~/hooks/useNavigationItems";
import { NavigationBar } from "~/components/navigation/NavigationBar";
import { MobileMenu } from "~/components/navigation/MobileMenu";

export function Navigation() {
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname || "/");
  const isWikiPage =
    normalizedPathname.startsWith("/wiki") ||
    normalizedPathname.startsWith("/blurbs");

  const { isMobile, mobileMenuOpen, setMobileMenuOpen } = useResponsiveNav(normalizedPathname);
  const { user, isLoaded } = useUser();
  const isImmersionPage =
    normalizedPathname.startsWith("/builder") ||
    normalizedPathname.startsWith("/mycountry/editor");
  const { totalUnread: messageUnreadCount } = useMessageUnreadCount();
  const { scrollY, isSticky, isNavVisible, onNavMouseEnter, onNavMouseLeave } = useNavigationScroll({
    mode: isImmersionPage ? "hidden" : "default",
  });

  const [isWriterMode, setIsWriterMode] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const checkWriterMode = () => {
      setIsWriterMode(document.documentElement.classList.contains("wikios-writer-mode"));
    };
    checkWriterMode();
    const observer = new MutationObserver(checkWriterMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const activeIsSticky = isSticky || isWriterMode;
  const activeScrollY = isWriterMode ? 56 : scrollY;

  // Use new role management system
  const isAdmin = useHasRoleLevel(10); // Admin level or higher (≤10 includes system owners)

  // Per-user Labs grant: any role carrying the `labs.access` permission.
  const hasLabsAccess = useHasPermission("labs.access");

  // Get premium status
  const { isPremium } = usePremium();

  const isStandalone = typeof window !== "undefined" && isStandaloneClient();

  // Get navigation settings from admin
  const { data: navigationSettings } = api.admin.getNavigationSettings.useQuery(undefined, {
    // Default to showing all tabs if query fails
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Get user profile to show linked country
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery();

  // Fetch country flag for user profile
  const { flag: userCountryFlag, loading: flagsLoading } = useCountryFlag(
    userProfile?.country?.name || ""
  );

  const isCurrentPage = (href: string) => {
    const cleanedHref = href.split("?")[0].split("#")[0] || "/";
    const normalizedHref = cleanedHref.startsWith("/") ? cleanedHref : `/${cleanedHref}`;
    if (normalizedPathname === normalizedHref) return true;
    return normalizedHref !== "/" && normalizedPathname.startsWith(`${normalizedHref}/`);
  };

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return "loading";
    if (!user) return "unauthenticated";
    if (!userProfile?.countryId) return "needs-setup";
    return "complete";
  };

  const setupStatus = getSetupStatus();

  // Filter visible navigation items based on user state and admin settings
  const visibleNavItems = useNavigationItems({
    user,
    isAdmin,
    isPremium,
    isStandalone,
    setupStatus,
    navigationSettings,
    hasLabsAccess,
  });

  const contextKey = getContextKey(normalizedPathname);
  const contextMenu = contextualMenus[contextKey] ?? contextualMenus.default;

  // Hide the global navigation entirely on maps pages since MapDynamicIsland handles it
  if (pathname?.startsWith("/maps")) return null;

  return (
    <>
      <nav
        onMouseEnter={onNavMouseEnter}
        onMouseLeave={onNavMouseLeave}
        className={`navigation-bar fixed top-0 right-0 left-0 z-[var(--z-navigation)] border-b backdrop-blur-xl transition-colors duration-200 ${
          isWikiPage
            ? "border-[var(--wikios-border)] bg-[var(--wikios-bg)] shadow-sm"
            : "border-border/40 bg-background/80 shadow-xs"
        }`}
        style={{
          opacity: isNavVisible ? 1 : 0,
          transform: isNavVisible ? "translateY(0)" : "translateY(-100%)",
          pointerEvents: isNavVisible ? "auto" : "none",
          transition: "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out, background-color 0.2s ease",
        }}
      >
        <div className="mx-auto max-w-none px-3 sm:px-4 md:px-6 lg:px-8">
          <NavigationBar
            visibleNavItems={visibleNavItems}
            isCurrentPage={isCurrentPage}
            messageUnreadCount={messageUnreadCount}
          />

          {/* Mobile Title Bar — DI pill replaces hamburger */}
          <div className="flex h-14 w-full items-center justify-between py-2 lg:hidden">
            <div className="flex min-w-0 flex-1 flex-col pr-3">
              <span className="text-muted-foreground/80 text-[10px] tracking-wide uppercase sm:text-[11px]">
                IxStats
              </span>
              <span className="text-foreground line-clamp-1 text-sm font-semibold sm:text-base">
                {contextMenu.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* DI pill on mobile */}
              <div className="max-w-[200px]">
                <CommandPalette isSticky={false} scrollY={0} />
              </div>
              {/* Compact nav trigger */}
              <button
                type="button"
                className="border-border/60 bg-background/80 text-foreground inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border p-2 shadow-sm backdrop-blur"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-expanded={mobileMenuOpen}
                aria-controls="ixstats-mobile-navigation"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-[calc(var(--z-navigation)+100)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside
              id="ixstats-mobile-navigation"
              role="dialog"
              aria-modal="true"
              className="border-border/40 bg-background/98 absolute top-0 left-0 h-full w-[min(90vw,360px)] max-w-full overflow-y-auto border-r px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl backdrop-blur-xl sm:px-5"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.28 }}
            >
              <MobileMenu
                contextMenu={contextMenu}
                visibleNavItems={visibleNavItems}
                isCurrentPage={isCurrentPage}
                normalizedPathname={normalizedPathname}
                onClose={() => setMobileMenuOpen(false)}
                user={user}
                userProfile={userProfile}
                setupStatus={setupStatus}
                userCountryFlag={userCountryFlag?.flagUrl || null}
                flagsLoading={flagsLoading}
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {!isMobile && (
        <motion.div
          onMouseEnter={onNavMouseEnter}
          onMouseLeave={onNavMouseLeave}
          className="pointer-events-none fixed top-0 right-0 left-0 z-[var(--z-command)] flex justify-center"
          animate={{
            y: activeIsSticky ? 8 : 10,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 1,
          }}
          style={{
            width: "100%",
            maxWidth: "100%",
          }}
        >
          <div className="pointer-events-auto">
            <CommandPalette isSticky={activeIsSticky} scrollY={activeScrollY} />
          </div>
        </motion.div>
      )}
    </>
  );
}
