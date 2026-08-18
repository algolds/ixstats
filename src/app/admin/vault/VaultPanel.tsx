"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, Users, ShoppingBag, History, Settings, Coins, Gift } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useIsAdmin } from "~/hooks/usePermissions";
import { useAuth } from "@clerk/nextjs";
import { usePageTitle } from "~/hooks/usePageTitle";

// Sub-components
import { VaultUserDirectory } from "./VaultUserDirectory";
import { VaultStoreControl } from "./VaultStoreControl";
import { VaultBonusAdmin } from "./VaultBonusAdmin";
import { VaultPurchaseLogs } from "./VaultPurchaseLogs";
import { VaultSystemConfig } from "./VaultSystemConfig";

type VaultTab = "users" | "store" | "bonuses" | "logs" | "config";


export default function AdminVaultPage() {
  usePageTitle({ title: "Admin - Vault Store & Economy" });
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [activeTab, setActiveTab] = useState<VaultTab>("users");

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push(withBasePath("/sign-in"));
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="mx-auto max-w-md border-red-500/20 bg-slate-900/50">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Shield className="h-10 w-10 animate-pulse text-red-400" />
            <h2 className="text-foreground text-lg font-semibold">Admin Access Required</h2>
            <p className="text-muted-foreground text-sm">
              You need administrative permissions to access the Vault Economy command center.
            </p>
            <Link href={withBasePath("/")}>
              <Button variant="outline" size="sm" className="border-white/10 text-white">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Safety
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-6 py-8">
      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Link href={withBasePath("/admin")} className="hover:text-foreground transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Vault & Economy</span>
          </div>
          <h1 className="text-foreground flex items-center gap-2 text-2xl font-black tracking-tight">
            <Coins className="h-6 w-6 text-amber-500" />
            Vault & Economy Control Suite
          </h1>
        </div>

        <Link href={withBasePath("/admin")}>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-white/10 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Admin Home
          </Button>
        </Link>
      </div>

      {/* Primary Tab Switcher */}
      <div className="flex gap-2 overflow-x-auto border-b border-white/5 pb-px">
        {[
          { id: "users" as VaultTab, label: "Users & Balances", icon: Users },
          { id: "store" as VaultTab, label: "Store Inventory", icon: ShoppingBag },
          { id: "bonuses" as VaultTab, label: "Metagame Bonuses", icon: Gift },
          { id: "logs" as VaultTab, label: "Purchase Audit Logs", icon: History },
          { id: "config" as VaultTab, label: "System", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? "border-amber-500 bg-amber-500/5 text-amber-400"
                  : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {activeTab === "users" && <VaultUserDirectory />}
        {activeTab === "store" && <VaultStoreControl />}
        {activeTab === "bonuses" && <VaultBonusAdmin />}
        {activeTab === "logs" && <VaultPurchaseLogs />}
        {activeTab === "config" && <VaultSystemConfig />}
      </div>

    </div>
  );
}
