"use client";

/**
 * The navigation shell: AppSidebar (≥1024px), TabBar (<1024px) and Halo as the floating island.
 * Wires the presentational components to the route, the signed-in user, the admin role, the
 * `labs.access` grant, the admin navigation settings, the persisted sidebar state and the source
 * list's disclosure state and live badges. Chromeless routes (`CHROMELESS_PREFIXES`: Maps and the
 * full-screen map editors) get no sidebar or tab bar.
 */

import { Suspense, useMemo, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useUser } from "~/context/auth-context";
import { useHasPermission, useHasRoleLevel, useIsBetaTester } from "~/hooks/usePermissions";
import { useAbility } from "~/components/providers/AbilityProvider";
import { api } from "~/trpc/react";
import { stripBasePath } from "~/lib/base-path";
import {
  getVisibleApps,
  isChromelessPath,
  type NavAction,
  type NavigationVisibilitySettings,
  type SearchParamsLike,
} from "~/lib/navigation/app-sections";
import { useDailyReward } from "~/components/vault/DailyRewardProvider";
import { useSidebarCollapsed } from "~/lib/navigation/use-sidebar-collapsed";
import { useNavExpanded } from "~/lib/navigation/use-nav-expanded";
import { AccountMenu } from "./AccountMenu";
import { AppSidebar } from "./AppSidebar";
import { TabBar } from "./TabBar";
import { ShellHalo } from "./ShellHalo";
import { useNavBadges } from "./use-nav-badges";

function WithSearchParams({ render }: { render: (params: SearchParamsLike | null) => ReactNode }) {
  const params = useSearchParams();
  return <>{render(params)}</>;
}

/** Query-aware render with a query-less fallback, so the shell never blocks prerendering. */
function SearchParamsBoundary({
  render,
}: {
  render: (params: SearchParamsLike | null) => ReactNode;
}) {
  return (
    <Suspense fallback={render(null)}>
      <WithSearchParams render={render} />
    </Suspense>
  );
}

export function FacetShell() {
  const pathname = stripBasePath(usePathname() || "/");
  const { user } = useUser();
  const isAdmin = useHasRoleLevel(10);
  // A `labs.access` grant (or a dev build) shows Labs despite `showLabsTab`.
  const hasLabsAccess = useHasPermission("labs.access") || process.env.NODE_ENV === "development";
  // Defense: the premium ability (premium tier, owner, admin, staff) or the beta-tester role.
  const hasPremiumAbility = useAbility().can("access", "MyCountryFeature", "defense");
  const isBetaTester = useIsBetaTester();
  const hasMycountryPremium = hasPremiumAbility || isBetaTester;
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
  const apps = useMemo(
    () =>
      getVisibleApps({
        signedIn,
        isAdmin,
        hasLabsAccess,
        hasMycountryPremium,
        navigationSettings: navigationSettings as NavigationVisibilitySettings | undefined,
      }),
    [signedIn, isAdmin, hasLabsAccess, hasMycountryPremium, navigationSettings]
  );

  return (
    <>
      {!isChromelessPath(pathname) && (
        <SearchParamsBoundary
          render={(searchParams) => (
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
        />
      )}
      <ShellHalo />
    </>
  );
}
