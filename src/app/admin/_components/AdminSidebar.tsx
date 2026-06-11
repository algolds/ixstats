// src/app/admin/_components/AdminSidebar.tsx
// Admin panel navigation sidebar with 6-section Link-based navigation
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LayoutDashboard,
  Settings,
  Gamepad2,
  Globe,
  Map,
  Users,
  Database,
  BookOpen,
  Sparkles,
  MessageCircle,
  Menu,
  Wallet,
  Package,
  Bell,
  Vote,
  Coins,
  Terminal,
} from "lucide-react";
import { withBasePath } from "@/lib/base-path";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Platform",
    href: "/admin/platform",
    icon: Settings,
    description: "Time, Economy, Bot & System",
  },
  {
    label: "Storyteller™",
    href: "/admin/storyteller",
    icon: Gamepad2,
    description: "World Events & Simulation",
  },
  {
    label: "Countries",
    href: "/admin/countries",
    icon: Globe,
    description: "Live Grid & Analytics",
  },
  {
    label: "Maps",
    href: "/admin/maps",
    icon: Map,
    description: "World Map & Assignments",
  },
  {
    label: "World Studio",
    href: "/admin/studio",
    icon: Sparkles,
    description: "Realms & World Configs",
  },
  {
    label: "Users & Roles",
    href: "/admin/users",
    icon: Users,
    description: "Management & Permissions",
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
    description: "Events, Logs & Alert Rules",
  },
  {
    label: "Card Management",
    href: "/admin/cards",
    icon: Package,
    description: "NS Sync, Card Packs",
  },
  {
    label: "Vault & Economy",
    href: "/admin/vault",
    icon: Coins,
    description: "Balances, Streaks & Store",
  },
  {
    label: "Reference Data",
    href: "/admin/reference-data",
    icon: Database,
    description: "Unified Data Manager",
  },
  {
    label: "WikiOS Administration",
    href: "/admin/wiki",
    icon: BookOpen,
    description: "Wiki Links & Scanning",
  },
  {
    label: "Blurbs",
    href: "/admin/blurbs",
    icon: MessageCircle,
    description: "Topic Prompts & Responses",
  },
  {
    label: "Polls",
    href: "/admin/polls",
    icon: Vote,
    description: "Create & Manage Feed Polls",
  },
  {
    label: "Logs",
    href: "/admin/logs",
    icon: Terminal,
    description: "System & Server Audit Trail",
  },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  const normalizedPath = pathname.replace(/\/$/, "") || "/admin";
  const normalizedHref = href.replace(/\/$/, "");
  if (exact) return normalizedPath === normalizedHref;
  return normalizedPath === normalizedHref || normalizedPath.startsWith(normalizedHref + "/");
}

export function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="border-border/50 border-b p-6">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="bg-primary/10 border-primary/20 rounded-xl border p-2">
            <Shield className="text-primary h-6 w-6" />
          </div>
          <div>
            <h1 className="text-foreground text-xl font-bold">Admin Console</h1>
            <p className="text-muted-foreground text-sm">System Management</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <nav className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, withBasePath(item.href), item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.description && !active && (
                    <p className="text-muted-foreground/70 truncate text-xs">{item.description}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="border-border/50 border-t p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span>System Online</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="fixed top-4 left-4 z-50 lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Admin Navigation</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="bg-card/50 border-border/50 hidden min-h-screen w-72 shrink-0 flex-col border-r backdrop-blur-sm lg:flex">
        {sidebarContent}
      </div>
    </>
  );
}
