// src/app/admin/_components/AdminNavigationContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { withBasePath, stripBasePath } from "~/lib/base-path";

interface AdminNavigationContextType {
  activeSection: string;
  onNavigate: (section: string) => void;
  sidebarHidden: boolean;
  setSidebarHidden: (hidden: boolean) => void;
}

const AdminNavigationContext = createContext<AdminNavigationContextType | undefined>(undefined);

const getSectionFromPathname = (rawPathname: string): string => {
  const pathname = stripBasePath(rawPathname).replace(/\/$/, "");
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";

  const segments = pathname.split("/");
  const lastSegment = segments[segments.length - 1];
  return lastSegment || "dashboard";
};

export function AdminNavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeSection, setActiveSection] = useState<string>(() =>
    getSectionFromPathname(pathname)
  );
  const [sidebarHidden, setSidebarHidden] = useState(false);

  // Sync URL popstate events (browser back/forward button)
  useEffect(() => {
    const handlePopState = () => {
      const sect = getSectionFromPathname(window.location.pathname);
      setActiveSection(sect);
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Update active section when Next.js pathname changes (direct navs)
  useEffect(() => {
    const routeSection = getSectionFromPathname(pathname);
    if (routeSection !== activeSection) {
      setActiveSection(routeSection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const onNavigate = useCallback((section: string) => {
    setActiveSection(section);
    const path = section === "dashboard" ? "/admin" : `/admin/${section}`;
    window.history.pushState(null, "", withBasePath(path));
    window.scrollTo({ top: 0, behavior: "instant" });

    // Set document title
    const formatted = section.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    document.title =
      section === "dashboard" ? "Admin Dashboard - IxStats" : `Admin - ${formatted} - IxStats`;
  }, []);

  return (
    <AdminNavigationContext.Provider
      value={{ activeSection, onNavigate, sidebarHidden, setSidebarHidden }}
    >
      {children}
    </AdminNavigationContext.Provider>
  );
}

export function useAdminNavigation(): AdminNavigationContextType {
  const context = useContext(AdminNavigationContext);
  if (!context) {
    return {
      activeSection: "dashboard",
      onNavigate: undefined as unknown as (section: string) => void,
      sidebarHidden: false,
      setSidebarHidden: () => {},
    };
  }
  return context;
}
