"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { SystemStatusStrip, SystemStatusWidget } from "./SystemStatusWidget";
import { AdminSidebarNavWidget } from "./AdminSidebarNavWidget";
import { useAdminNavigation } from "./AdminNavigationContext";

interface AdminSidebarLayoutProps {
  children: ReactNode;
  activeSection?: string;
  onNavigate?: (section: string) => void;
}

export function AdminSidebarLayout({
  children,
  activeSection: propActiveSection,
  onNavigate: propOnNavigate,
}: AdminSidebarLayoutProps) {
  const ctx = useAdminNavigation();
  const activeSection = propActiveSection ?? ctx.activeSection;
  const onNavigate = propOnNavigate ?? ctx.onNavigate;
  const sidebarHidden = ctx.sidebarHidden;
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (section: string) => {
    if (onNavigate) {
      onNavigate(section);
    }
    setIsOpen(false);
  };

  const sidebarContent = (
    <div className="flex min-h-full flex-col space-y-4 p-4">
      <SystemStatusWidget />
      <AdminSidebarNavWidget onNavigate={handleNavigate} activeSection={activeSection} />
    </div>
  );

  return (
    <div className="bg-grouped text-label relative min-h-screen">
      {/* Mobile Sub-Navigation Header — sits cleanly below global mobile nav (hidden under the new
          shell, where the TabBar's More sheet lists the console's sections) */}
      <div
        data-app-subnav=""
        className="border-separator material-thin sticky top-14 right-0 left-0 z-30 flex h-12 items-center border-b px-4 lg:hidden"
      >
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon-sm">
              <Menu aria-hidden className="size-4" />
              <span className="sr-only">Toggle admin navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Admin navigation menu</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
        {onNavigate ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("dashboard")}
            className="text-headline text-label-secondary hover:text-label ml-1 px-2"
          >
            Admin console
          </Button>
        ) : (
          <Link
            href="/admin"
            className="text-headline text-label-secondary hover:text-label ml-3 transition-colors"
          >
            Admin console
          </Link>
        )}
      </div>

      <div className="relative z-10 container mx-auto px-4 py-4 sm:py-6 md:py-8 lg:px-6 lg:pt-8">
        {/* Main Layout — rail + content */}
        <div className="flex gap-6 lg:gap-8">
          {/* Desktop: Sticky rail (hidden in fullscreen mode). The whole rail is app sub-navigation:
              under the new shell the AppSidebar lists its sections and the status strip above the
              content carries SystemStatusWidget's information. */}
          {!sidebarHidden && (
            <div
              data-app-subnav=""
              className="sticky top-(--shell-top-offset) z-30 hidden w-72 shrink-0 space-y-4 self-start lg:block"
            >
              <SystemStatusWidget />
              {/* The console's section rail; the AppSidebar lists it under the new shell. */}
              <AdminSidebarNavWidget
                onNavigate={onNavigate}
                activeSection={activeSection}
                data-app-subnav=""
              />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <SystemStatusStrip className="mb-6" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
