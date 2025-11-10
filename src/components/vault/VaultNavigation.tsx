"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Package,
  ShoppingCart,
  Folder,
  Grid3x3,
  Download,
  X
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

interface VaultNavigationProps {
  className?: string;
  onClose?: () => void;
}

const navItems = [
  {
    label: "Dashboard",
    href: "/vault",
    icon: Home,
  },
  {
    label: "Packs",
    href: "/vault/packs",
    icon: Package,
  },
  {
    label: "Market",
    href: "/vault/market",
    icon: ShoppingCart,
  },
  {
    label: "Collections",
    href: "/vault/collections",
    icon: Folder,
  },
  {
    label: "Inventory",
    href: "/vault/inventory",
    icon: Grid3x3,
  },
  {
    label: "Import NS Deck",
    href: "/vault/import",
    icon: Download,
  },
];

export function VaultNavigation({ className, onClose }: VaultNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-2", className)}>
      {/* Close button for mobile drawer */}
      {onClose && (
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-lg font-bold text-gold-400">MyVault</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Navigation links */}
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200",
              "hover:bg-white/5",
              isActive && "bg-gold-500/20 text-gold-400 shadow-lg shadow-gold-500/20"
            )}
          >
            <Icon className={cn("h-5 w-5", isActive && "text-gold-400")} />
            <span className={cn("font-medium", isActive && "text-gold-400")}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
