"use client";

import { Coins, Bell, Menu } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { UserButton } from "@clerk/nextjs";

interface VaultHeaderProps {
  balance?: number;
  loading?: boolean;
  onRefresh?: () => void;
  onMenuClick?: () => void;
}

export function VaultHeader({
  balance = 0,
  loading = false,
  onRefresh,
  onMenuClick
}: VaultHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Desktop title */}
        <div className="hidden md:block">
          <h1 className="text-xl font-bold text-gold-400">MyVault</h1>
        </div>

        {/* IxCredits balance */}
        <div className="flex items-center gap-4">
          <Card className="glass-hierarchy-child flex items-center gap-2 px-4 py-2">
            <Coins className="h-5 w-5 text-gold-400" />
            {loading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gold-400">
                  {balance.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">IxC</span>
              </div>
            )}
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className="h-6 w-6 p-0"
              >
                ↻
              </Button>
            )}
          </Card>

          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            {/* Notification badge */}
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          </Button>

          {/* User profile */}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
