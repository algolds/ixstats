"use client";

/**
 * The navigation shell: AppSidebar (≥1024px), TabBar (<1024px) and Halo as the floating island.
 * Wires the presentational components to the route, the signed-in user, the admin role, the
 * `labs.access` grant, the admin navigation settings, the persisted sidebar state and the source
 * list's disclosure state and live badges. Chromeless routes (`CHROMELESS_PREFIXES`: Maps and the
 * full-screen map editors) get no sidebar or tab bar.
 */

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useUser } from "~/context/auth-context";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { useCanOpenAdmin, useHasPermission, useIsAdmin } from "~/hooks/usePermissions";
import { useHasMycountryPremium } from "~/hooks/useHasMycountryPremium";
import { useUserCountry } from "~/hooks/useUserCountry";
import { getNationUrl } from "~/lib/utils/slug-utils";
import { api } from "~/trpc/react";
import { stripBasePath } from "~/lib/base-path";
import {
  getVisibleApps,
  isChromelessPath,
  matchesPrefix,
  withCountryRows,
  type NavAction,
  type NavigationVisibilitySettings,
} from "~/lib/navigation/app-sections";
import { useDailyReward } from "~/components/vault/DailyRewardProvider";
import {
  toggleSidebarCollapsed,
  useSidebarCollapsed,
} from "~/lib/navigation/use-sidebar-collapsed";
import { useNavExpanded } from "~/lib/navigation/use-nav-expanded";
import { AccountMenu } from "./AccountMenu";
import { AppSidebar } from "./AppSidebar";
import { FeedbackModal } from "./FeedbackModal";
import { SidebarVaultCard } from "./SidebarVaultCard";
import { TabBar } from "./TabBar";
import { ShellHalo } from "./ShellHalo";
import { useForumNavFlags } from "./use-forum-nav-flags";
import { useNavBadges } from "./use-nav-badges";
import { useHydrated } from "~/hooks/useHydrated";

export function FacetShell() {
  const pathname = stripBasePath(usePathname() || "/");
  // No Suspense around this: a boundary hydrates in a later pass, by which time Clerk and the nav
  // queries may have loaded, so it would hydrate signed-in over signed-out server HTML. The root
  // layout reads headers(), so every route is dynamic and useSearchParams never blocks prerendering.
  const searchParams = useSearchParams();
  const { user } = useUser();
  const isAdmin = useIsAdmin();
  const canOpenAdmin = useCanOpenAdmin();
  // A `labs.access` grant (or a dev build) shows Labs despite `showLabsTab`.
  const hasLabsAccess = useHasPermission("labs.access") || process.env.NODE_ENV === "development";
  // Defense row: MyCountry Premium or the beta-tester role (the Defense page and the server agree).
  const hasMycountryPremium = useHasMycountryPremium("defense");
  const { data: navigationSettings } = api.admin.getNavigationSettings.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const { expanded, toggle } = useNavExpanded();
  const { open: openDailyReward } = useDailyReward();
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [backHref, setBackHref] = React.useState("/dashboard");
  const chromeless = isChromelessPath(pathname);
  const isAreaRoute = matchesPrefix(pathname, "/settings") || matchesPrefix(pathname, "/admin");
  if (!chromeless && !isAreaRoute && pathname !== backHref) {
    setBackHref(pathname);
  }

  const onAction = (action: NavAction) => {
    if (action === "daily-reward") openDailyReward();
  };

  const signedIn = Boolean(user);

  const onShellKeyDown = React.useEffectEvent((event: KeyboardEvent) => {
    if (chromeless || event.repeat) return;
    if (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key === "\\"
    ) {
      const active = document.activeElement as HTMLElement | null;
      const inEditor =
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        active?.getAttribute("contenteditable") === "true" ||
        active?.closest('[contenteditable="true"]') != null ||
        active?.closest(".cm-editor") != null ||
        active?.closest("[data-slate-editor]") != null;
      if (inEditor && !active?.hasAttribute("data-command-palette-search")) return;
      event.preventDefault();
      toggleSidebarCollapsed();
    }
  });

  const onDailyRewardEvent = React.useEffectEvent(() => {
    if (signedIn) openDailyReward();
  });

  const onFeedbackEvent = React.useEffectEvent(() => {
    if (signedIn) setFeedbackOpen(true);
  });

  React.useEffect(() => {
    window.addEventListener("keydown", onShellKeyDown);
    window.addEventListener("ix:open-daily-reward", onDailyRewardEvent);
    window.addEventListener("ix:open-feedback", onFeedbackEvent);
    return () => {
      window.removeEventListener("keydown", onShellKeyDown);
      window.removeEventListener("ix:open-daily-reward", onDailyRewardEvent);
      window.removeEventListener("ix:open-feedback", onFeedbackEvent);
    };
  }, []);
  // The server renders the nav knowing nothing (signed out, no queries); the hydrating pass matches it even when a
  // query already answered (a late or retried hydration), and the live nav follows right after.
  const hydrated = useHydrated();
  // Once here so the sidebar and the More sheet never run the queries twice.
  const badges = useNavBadges(signedIn);
  const { forumModerator } = useForumNavFlags(signedIn);
  // Shares AccountMenu's queries; MyCountry's profile and editor buttons appear once it answers.
  const { country } = useUserCountry();
  const countryHref = hydrated && country ? getNationUrl(country.name) : undefined;
  const countryMeta =
    hydrated && country
      ? { id: country.id, slug: country.slug ?? undefined, name: country.name }
      : undefined;
  const navSettings = navigationSettings as NavigationVisibilitySettings | undefined;
  const apps = getVisibleApps(
    hydrated
      ? {
          signedIn,
          isAdmin,
          canOpenAdmin,
          hasLabsAccess,
          hasMycountryPremium,
          forumModerator,
          ownsNation: Boolean(country),
          navigationSettings: navSettings,
        }
      : { signedIn: false, isAdmin: false }
  );
  // Search lists exactly what the sidebar shows this viewer, plus the nation's profile and editor rows.
  const searchApps = withCountryRows(apps, countryHref, countryMeta);
  const openFeedback = () => setFeedbackOpen(true);

  return (
    <>
      {!chromeless && (
        <>
          <AppSidebar
            pathname={pathname}
            searchParams={searchParams}
            apps={apps}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            expanded={expanded}
            onToggle={toggle}
            badges={badges}
            onAction={onAction}
            countryHref={countryHref}
            countryMeta={countryMeta}
            backHref={backHref}
            signedIn={signedIn}
            vaultCard={signedIn ? <SidebarVaultCard /> : undefined}
            account={
              <AccountMenu layout="sidebar" collapsed={collapsed} onOpenFeedback={openFeedback} />
            }
          />
          <TabBar
            pathname={pathname}
            searchParams={searchParams}
            apps={apps}
            expanded={expanded}
            onToggle={toggle}
            badges={badges}
            onAction={onAction}
            countryHref={countryHref}
            countryMeta={countryMeta}
            backHref={backHref}
            account={<AccountMenu layout="sheet" onOpenFeedback={openFeedback} />}
          />
        </>
      )}
      <ShellHalo trayApps={apps} searchApps={searchApps} />
      {signedIn && (
        <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
          <DialogContent>
            <FeedbackModal onClose={() => setFeedbackOpen(false)} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
