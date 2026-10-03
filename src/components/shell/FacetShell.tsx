"use client";

/**
 * The navigation shell: AppSidebar (≥1024px), TabBar (<1024px) and Halo as the floating island.
 * Wires the presentational components to the route, the signed-in user, the admin role, the
 * `labs.access` grant, the admin navigation settings and the persisted sidebar state. Chromeless
 * routes (`CHROMELESS_PREFIXES`: Maps and the full-screen map editors) get no sidebar or tab bar.
 */

import { Suspense, useMemo, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useUser } from "~/context/auth-context";
import { useHasPermission, useHasRoleLevel } from "~/hooks/usePermissions";
import { api } from "~/trpc/react";
import { stripBasePath } from "~/lib/base-path";
import {
  getVisibleApps,
  isChromelessPath,
  type NavigationVisibilitySettings,
  type SearchParamsLike,
} from "~/lib/navigation/app-sections";
import { useSidebarCollapsed } from "~/lib/navigation/use-sidebar-collapsed";
import { AccountMenu } from "./AccountMenu";
import { AppSidebar } from "./AppSidebar";
import { TabBar } from "./TabBar";
import { ShellHalo } from "./ShellHalo";

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
  const { data: navigationSettings } = api.admin.getNavigationSettings.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { collapsed, setCollapsed } = useSidebarCollapsed();

  const signedIn = Boolean(user);
  const apps = useMemo(
    () =>
      getVisibleApps({
        signedIn,
        isAdmin,
        hasLabsAccess,
        navigationSettings: navigationSettings as NavigationVisibilitySettings | undefined,
      }),
    [signedIn, isAdmin, hasLabsAccess, navigationSettings]
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
                account={<AccountMenu layout="sidebar" collapsed={collapsed} />}
              />
              <TabBar
                pathname={pathname}
                searchParams={searchParams}
                apps={apps}
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
