"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft, Users, ShoppingBag, History, Settings, Coins } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useIsAdmin } from "~/hooks/usePermissions";
import { useAuth } from "@clerk/nextjs";
import { usePageTitle } from "~/hooks/usePageTitle";

// Sub-components
import { VaultUserDirectory } from "./VaultUserDirectory";
import { VaultStoreControl } from "./VaultStoreControl";
import { VaultPurchaseLogs } from "./VaultPurchaseLogs";
import { VaultSystemConfig } from "./VaultSystemConfig";

type VaultTab = "users" | "store" | "logs" | "config";

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
            <Shield className="text-red-400 h-10 w-10 animate-pulse" />
            <h2 className="text-lg font-semibold text-foreground">Admin Access Required</h2>
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
    <div className="px-6 py-8 space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href={withBasePath("/admin")} className="hover:text-foreground transition-colors">
              Admin 
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Vault & Economy</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-500" />
            Vault & Economy Control Suite
          </h1>
        </div>

        <Link href={withBasePath("/admin")}>
          <Button variant="outline" size="sm" className="h-9 border-white/10 text-slate-300 hover:text-white">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Admin Home
          </Button>
        </Link>
      </div>

      {/* Primary Tab Switcher */}
      <div className="border-b border-white/5 flex gap-2 overflow-x-auto pb-px">
        {[
          { id: "users" as VaultTab, label: "Users & Balances", icon: Users },
          { id: "store" as VaultTab, label: "Store Inventory", icon: ShoppingBag },
          { id: "logs" as VaultTab, label: "Purchase Audit Logs", icon: History },
          { id: "config" as VaultTab, label: "System", icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all shrink-0 ${
                isActive
                  ? "border-amber-500 text-amber-400 bg-amber-500/5"
                  : "border-transparent text-slate-400 hover:text-white hover:bg-white/5"
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
        {activeTab === "logs" && <VaultPurchaseLogs />}
        {activeTab === "config" && <VaultSystemConfig />}
      </div>
    </div>
  );
}
