"use client";

/**
 * The navigation shell: AppSidebar (≥1024px), TabBar (<1024px) and Halo as the floating island.
 * Wires the presentational components to the route, the signed-in user, the admin role, the
 * `labs.access` grant, the admin navigation settings, the persisted sidebar state and the source
 * list's disclosure state and live badges. Chromeless routes (`CHROMELESS_PREFIXES`: Maps and the
 * full-screen map editors) get no sidebar or tab bar.
 */

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useUser } from "~/context/auth-context";
import { useHasPermission, useHasRoleLevel } from "~/hooks/usePermissions";
import { useHasMycountryPremium } from "~/hooks/useHasMycountryPremium";
import { api } from "~/trpc/react";
import { stripBasePath } from "~/lib/base-path";
import {
  getVisibleApps,
  isChromelessPath,
  type NavAction,
  type NavigationVisibilitySettings,
} from "~/lib/navigation/app-sections";
import { useDailyReward } from "~/components/vault/DailyRewardProvider";
import { useSidebarCollapsed } from "~/lib/navigation/use-sidebar-collapsed";
import { useNavExpanded } from "~/lib/navigation/use-nav-expanded";
import { AccountMenu } from "./AccountMenu";
import { AppSidebar } from "./AppSidebar";
import { SidebarVaultCard } from "./SidebarVaultCard";
import { TabBar } from "./TabBar";
import { ShellHalo } from "./ShellHalo";
import { realmMarkSrc, withRealmMark } from "./realm-nav-icon";
import { useForumNavFlags } from "./use-forum-nav-flags";
import { useNavBadges } from "./use-nav-badges";

export function FacetShell() {
  const pathname = stripBasePath(usePathname() || "/");
  // No Suspense around this: a boundary hydrates in a later pass, by which time Clerk and the nav
  // queries may have loaded, so it would hydrate signed-in over signed-out server HTML. The root
  // layout reads headers(), so every route is dynamic and useSearchParams never blocks prerendering.
  const searchParams = useSearchParams();
  const { user } = useUser();
  const isAdmin = useHasRoleLevel(10);
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
  const onAction = (action: NavAction) => {
    if (action === "daily-reward") openDailyReward();
  };

  const signedIn = Boolean(user);
  // Once here so the sidebar and the More sheet never run the queries twice.
  const badges = useNavBadges(signedIn);
  const { realmMember, forumModerator, realm } = useForumNavFlags(signedIn);
  const realmMark = realmMarkSrc(realm);
  const apps = useMemo(
    () =>
      withRealmMark(
        getVisibleApps({
          signedIn,
          isAdmin,
          hasLabsAccess,
          hasMycountryPremium,
          realmMember,
          forumModerator,
          navigationSettings: navigationSettings as NavigationVisibilitySettings | undefined,
        }),
        realmMark
      ),
    [
      signedIn,
      isAdmin,
      hasLabsAccess,
      hasMycountryPremium,
      realmMember,
      forumModerator,
      realmMark,
      navigationSettings,
    ]
  );

  return (
    <>
      {!isChromelessPath(pathname) && (
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
            signedIn={signedIn}
            vaultCard={
              signedIn ? (
                <SidebarVaultCard
                  expanded={expanded.has("vault-card")}
                  onToggle={() => toggle("vault-card")}
                />
              ) : undefined
            }
            account={<AccountMenu layout="sidebar" collapsed={collapsed} />}
          />
          <TabBar
            pathname={pathname}
            searchParams={searchParams}
            apps={apps}
            expanded={expanded}
            onToggle={toggle}
            badges={badges}
            onAction={onAction}
            account={<AccountMenu layout="sheet" />}
          />
        </>
      )}
      <ShellHalo />
    </>
  );
}
