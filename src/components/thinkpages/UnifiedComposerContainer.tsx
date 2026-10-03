"use client";

import React, { useState } from "react";
import { EditPencil as PenSquare, Group as Users } from "iconoir-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";
import { GlassCanvasComposer } from "./GlassCanvasComposer";
import { EnhancedAccountManager } from "./EnhancedAccountManager";
import { Card } from "~/components/ui/card";

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

  const handlers = {
    onAccountSelect: onAccountSelect || (() => {}),
    onAccountSettings: onAccountSettings || (() => {}),
    onCreateAccount: onCreateAccount || (() => {}),
  };
  const renderComposer = (emptyPlaceholder: string) => (
    <GlassCanvasComposer
      {...handlers}
      account={selectedAccount}
      accounts={accounts}
      isOwner={isOwner}
      onPost={onPost}
      placeholder={repostData ? "Add a comment to your repost..." : emptyPlaceholder}
      countryId={countryId}
      repostData={repostData}
    />
  );

  // Without the accounts tab, show only the composer
  if (hideAccountsTab) {
    return (
      <div>
        {selectedAccount ? (
          renderComposer("What's happening?")
        ) : (
          <Card>
            <EmptyState
              icon={<Users />}
              title="No account selected"
              message="Select an account to post."
            />
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card>
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "compose" | "accounts")}
        className="w-full"
      >
        <div className="border-separator border-b p-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compose" className="gap-2" aria-label="Compose">
              <PenSquare className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Compose</span>
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2" aria-label="Accounts">
              <Users className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="compose" className="m-0 p-0">
          {selectedAccount ? (
            renderComposer("What's happening in your nation?")
          ) : (
            <EmptyState
              icon={<Users />}
              title="Select an account to compose"
              message="Choose an account in the Accounts tab to post."
              action={
                <Button variant="outline" onClick={() => setActiveTab("accounts")}>
                  <Users aria-hidden="true" />
                  Manage accounts
                </Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="accounts" className="m-0 p-0">
          <EnhancedAccountManager
            {...handlers}
            accounts={accounts}
            selectedAccount={selectedAccount}
            isOwner={isOwner}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
