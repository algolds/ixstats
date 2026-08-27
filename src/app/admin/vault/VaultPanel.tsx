// src/app/admin/vault/VaultPanel.tsx
// Vault Store & Economy Command Suite
"use client";

import { useState } from "react";
import {
  Group as Users,
  ShoppingBag,
  ClockRotateRight as History,
  Settings,
  Coins,
  Gift,
} from "iconoir-react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Sub-components
import { VaultUserDirectory } from "./VaultUserDirectory";
import { VaultStoreControl } from "./VaultStoreControl";
import { VaultBonusAdmin } from "./VaultBonusAdmin";
import { VaultPurchaseLogs } from "./VaultPurchaseLogs";
import { VaultSystemConfig } from "./VaultSystemConfig";

type VaultTab = "users" | "store" | "bonuses" | "logs" | "config";

export default function AdminVaultPage() {
  usePageTitle({ title: "Admin - Vault Store & Economy" });
  const [activeTab, setActiveTab] = useState<VaultTab>("users");

  return (
    <div className="space-y-6">
      <AdminHeader
        icon={Coins}
        title="Vault & Economy Control Suite"
        description="Oversee user credit balances, store catalog items, metagame bonuses, and real-time transaction purchase logs."
      />

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as VaultTab)}
        className="w-full"
      >
        <TabsList className="bg-card/40 border-border/40 mb-4 flex w-full flex-wrap justify-start gap-1 rounded-xl border p-1 backdrop-blur-md">
          <TabsTrigger
            value="users"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Users className="h-4 w-4" />
            Users & Balances
          </TabsTrigger>
          <TabsTrigger
            value="store"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <ShoppingBag className="h-4 w-4" />
            Store Inventory
          </TabsTrigger>
          <TabsTrigger
            value="bonuses"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Gift className="h-4 w-4" />
            Metagame Bonuses
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <History className="h-4 w-4" />
            Purchase Logs
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="flex items-center gap-2 text-xs font-semibold transition-transform active:scale-[0.98]"
          >
            <Settings className="h-4 w-4" />
            System Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4 focus-visible:outline-none">
          <VaultUserDirectory />
        </TabsContent>

        <TabsContent value="store" className="mt-4 focus-visible:outline-none">
          <VaultStoreControl />
        </TabsContent>

        <TabsContent value="bonuses" className="mt-4 focus-visible:outline-none">
          <VaultBonusAdmin />
        </TabsContent>

        <TabsContent value="logs" className="mt-4 focus-visible:outline-none">
          <VaultPurchaseLogs />
        </TabsContent>

        <TabsContent value="config" className="mt-4 focus-visible:outline-none">
          <VaultSystemConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
