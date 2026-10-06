"use client";
// src/app/admin/vault/VaultPanel.tsx
// Vault Store & Economy Command Suite

import { useState } from "react";
import {
  Group as Users,
  ShoppingBag,
  ClockRotateRight as History,
  Settings,
  Gift,
  Coins,
} from "iconoir-react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { PageHeader } from "~/components/shell/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

// Sub-components
import { VaultUserDirectory } from "./VaultUserDirectory";
import { VaultStoreControl } from "./VaultStoreControl";
import { VaultBonusAdmin } from "./VaultBonusAdmin";
import { VaultPurchaseLogs } from "./VaultPurchaseLogs";
import { VaultSystemConfig } from "./VaultSystemConfig";
import { ExchangeAdmin } from "./ExchangeAdmin";

type VaultTab = "users" | "store" | "bonuses" | "logs" | "exchange" | "config";

export default function AdminVaultPage() {
  usePageTitle({ title: "Admin - Vault Store & Economy" });
  const [activeTab, setActiveTab] = useState<VaultTab>("users");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vault and economy"
        subtitle="User credit balances, store items, metagame bonuses and purchase logs."
      />

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as VaultTab)}
        className="w-full"
      >
        <TabsList className="bg-fill-3 rounded-row mb-4 flex w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="users" className="text-caption flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users & balances
          </TabsTrigger>
          <TabsTrigger value="store" className="text-caption flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Store inventory
          </TabsTrigger>
          <TabsTrigger value="bonuses" className="text-caption flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Metagame bonuses
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-caption flex items-center gap-2">
            <History className="h-4 w-4" />
            Purchase logs
          </TabsTrigger>
          <TabsTrigger value="exchange" className="text-caption flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Exchange
          </TabsTrigger>
          <TabsTrigger value="config" className="text-caption flex items-center gap-2">
            <Settings className="h-4 w-4" />
            System config
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

        <TabsContent value="exchange" className="mt-4 focus-visible:outline-none">
          <ExchangeAdmin />
        </TabsContent>

        <TabsContent value="config" className="mt-4 focus-visible:outline-none">
          <VaultSystemConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}
