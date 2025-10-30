"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";
import { PenSquare, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { GlassCanvasComposer } from "./GlassCanvasComposer";
import { EnhancedAccountManager } from "./EnhancedAccountManager";

interface UnifiedComposerContainerProps {
  countryId: string;
  selectedAccount: any;
  accounts: any[];
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
  isOwner: boolean;
  onPost: () => void;
  repostData?: {
    originalPost: any;
    mode: "repost";
  };
  hideAccountsTab?: boolean;
}

export function UnifiedComposerContainer({
  countryId,
  selectedAccount,
  accounts,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  isOwner,
  onPost,
  repostData,
  hideAccountsTab = false,
}: UnifiedComposerContainerProps) {
  const [activeTab, setActiveTab] = useState<"compose" | "accounts">(
    selectedAccount ? "compose" : "accounts"
  );

  // If hiding accounts tab, show only composer without tabs
  if (hideAccountsTab) {
    return (
      <Card className="glass-hierarchy-interactive border-purple-500/30 bg-purple-500/5">
        {selectedAccount ? (
          <GlassCanvasComposer
            account={selectedAccount}
            accounts={accounts}
            onAccountSelect={onAccountSelect || (() => {})}
            onAccountSettings={onAccountSettings || (() => {})}
            onCreateAccount={onCreateAccount || (() => {})}
            isOwner={isOwner}
            onPost={onPost}
            placeholder={
              repostData ? "Add a comment to your repost..." : "What's happening in your nation?"
            }
            countryId={countryId}
            repostData={repostData}
          />
        ) : (
          <div className="p-8 text-center">
            <div className="text-muted-foreground mb-4">
              <Users className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <h3 className="mb-2 text-lg font-semibold">No Account Selected</h3>
              <p className="text-sm">Please select an account to start posting</p>
            </div>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="glass-hierarchy-interactive border-purple-500/30 bg-purple-500/5">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "compose" | "accounts")}
        className="w-full"
      >
        <div className="border-b border-white/10 p-4">
          <TabsList className="grid w-full grid-cols-2 bg-white/5">
            <TabsTrigger
              value="compose"
              className="flex items-center gap-2 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
            >
              <PenSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Compose</span>
            </TabsTrigger>
            <TabsTrigger
              value="accounts"
              className="flex items-center gap-2 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="compose" className="m-0 p-0">
          {selectedAccount ? (
            <GlassCanvasComposer
              account={selectedAccount}
              accounts={accounts}
              onAccountSelect={onAccountSelect || (() => {})}
              onAccountSettings={onAccountSettings || (() => {})}
              onCreateAccount={onCreateAccount || (() => {})}
              isOwner={isOwner}
              onPost={onPost}
              placeholder={
                repostData ? "Add a comment to your repost..." : "What's happening in your nation?"
              }
              countryId={countryId}
              repostData={repostData}
            />
          ) : (
            <div className="p-8 text-center">
              <div className="text-muted-foreground mb-4">
                <Users className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <h3 className="mb-2 text-lg font-semibold">Select an Account to Compose</h3>
                <p className="text-sm">Choose an account from the Accounts tab to start posting</p>
              </div>
              <Button variant="outline" onClick={() => setActiveTab("accounts")} className="mt-4">
                <Users className="mr-2 h-4 w-4" />
                Manage Accounts
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="m-0 p-0">
          <EnhancedAccountManager
            countryId={countryId}
            accounts={accounts}
            selectedAccount={selectedAccount}
            onAccountSelect={onAccountSelect || (() => {})}
            onAccountSettings={onAccountSettings || (() => {})}
            onCreateAccount={onCreateAccount || (() => {})}
            isOwner={isOwner}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
