"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { SystemStatusWidget } from "./SystemStatusWidget";
import { AdminSidebarNavWidget } from "./AdminSidebarNavWidget";

interface AdminSidebarLayoutProps {
  children: ReactNode;
}

export function AdminSidebarLayout({ children }: AdminSidebarLayoutProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sidebarContent = (
    <div className="flex min-h-full flex-col space-y-4 p-4">
      <SystemStatusWidget />
      <AdminSidebarNavWidget onNavigate={() => setIsOpen(false)} />
    </div>
  );

  return (
    <div className="bg-background text-foreground relative min-h-screen">
      {/* Mobile Navigation Header */}
      <div className="border-border/40 bg-background/60 fixed top-0 right-0 left-0 z-40 flex h-14 items-center border-b px-4 backdrop-blur-md lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-card/50 border-border/40 hover:bg-muted/50 h-9 w-9"
            >
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle Admin Navigation</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="border-border/40 bg-card/90 w-80 overflow-y-auto border-r p-0 backdrop-blur-xl"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Admin Navigation Menu</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
        <span className="text-muted-foreground/80 ml-3 text-sm font-bold tracking-wide uppercase">
          Admin Console
        </span>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-4 pt-18 sm:py-6 md:py-8 lg:px-6 lg:pt-8">
        {/* Main Layout — rail + content */}
        <div className="flex gap-6 lg:gap-8">
          {/* Desktop: Sticky rail */}
          <div className="sticky top-6 z-30 hidden w-72 shrink-0 self-start space-y-4 lg:block">
            <SystemStatusWidget />
            <AdminSidebarNavWidget />
          </div>

          {/* Main Content */}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
