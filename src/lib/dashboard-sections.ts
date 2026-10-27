import { stripBasePath } from "~/lib/base-path";

/** The Dashboard's single-page sections (DashboardRouter shows one at a time). */
export type DashboardSection = "home" | "accounts";

export const DASHBOARD_SECTION_PATHS: Record<DashboardSection, string> = {
  home: "/dashboard",
  accounts: "/dashboard/accounts",
};

export const DASHBOARD_SECTION_TITLES: Record<DashboardSection, string> = {
  home: "Dashboard",
  accounts: "Accounts",
};

/** The section a dashboard URL opens. /dashboard/post, /profile and /saved are pages of their own, never sections. */
export function getDashboardSection(rawPathname: string): DashboardSection {
  const pathname = stripBasePath(rawPathname);
  const accounts = DASHBOARD_SECTION_PATHS.accounts;
  return pathname === accounts || pathname.startsWith(`${accounts}/`) ? "accounts" : "home";
}
