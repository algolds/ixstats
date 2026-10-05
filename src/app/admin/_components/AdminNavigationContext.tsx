"use client";
// src/app/admin/_components/AdminNavigationContext.tsx

import React, { createContext, useContext, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { withBasePath, stripBasePath } from "~/lib/base-path";
import { usePageTitle } from "~/hooks/usePageTitle";

interface AdminNavigationContextType {
  activeSection: string;
  onNavigate: (section: string) => void;
}

const AdminNavigationContext = createContext<AdminNavigationContextType | undefined>(undefined);

const getSectionFromPathname = (rawPathname: string): string => {
  const pathname = stripBasePath(rawPathname).replace(/\/$/, "");
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";

  const segments = pathname.split("/");
  const lastSegment = segments[segments.length - 1];
  return lastSegment || "dashboard";
};

const getSectionTitle = (section: string): string =>
  section === "dashboard"
    ? "Admin Dashboard"
    : `Admin - ${section.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;

export function AdminNavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Derived, not mirrored in state: a state copy synced by an effect renders the previous
  // section's panel (and fires its queries) for one pass after every navigation.
  const activeSection = useMemo(() => getSectionFromPathname(pathname), [pathname]);

  usePageTitle({ title: getSectionTitle(activeSection) });

  // Next.js folds pushState into usePathname, so this switches section without a route
  // transition (the dashboard's tiles) and back/forward follow the same path.
  const onNavigate = useCallback((section: string) => {
    const path = section === "dashboard" ? "/admin" : `/admin/${section}`;
    window.history.pushState(null, "", withBasePath(path));
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const value = useMemo(() => ({ activeSection, onNavigate }), [activeSection, onNavigate]);

  return (
    <AdminNavigationContext.Provider value={value}>{children}</AdminNavigationContext.Provider>
  );
}

export function useAdminNavigation(): AdminNavigationContextType {
  const context = useContext(AdminNavigationContext);
  if (!context) {
    return {
      activeSection: "dashboard",
      onNavigate: undefined as unknown as (section: string) => void,
    };
  }
  return context;
}
