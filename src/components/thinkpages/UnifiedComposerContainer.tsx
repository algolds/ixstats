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

  // If hiding accounts tab, show only composer without tabs
  if (hideAccountsTab) {
    return (
      <div>
        {selectedAccount ? (
          <GlassCanvasComposer
            account={selectedAccount}
            accounts={accounts}
            onAccountSelect={onAccountSelect || (() => {})}
            onAccountSettings={onAccountSettings || (() => {})}
            onCreateAccount={onCreateAccount || (() => {})}
            isOwner={isOwner}
            onPost={onPost}
            placeholder={repostData ? "Add a comment to your repost..." : "What's happening?"}
            countryId={countryId}
            repostData={repostData}
          />
        ) : (
          <Card>
            <EmptyState
              icon={<Users />}
              title="No Account Selected"
              message="Please select an account to start posting"
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
            <EmptyState
              icon={<Users />}
              title="Select an Account to Compose"
              message="Choose an account from the Accounts tab to start posting"
              action={
                <Button variant="outline" onClick={() => setActiveTab("accounts")}>
                  <Users aria-hidden="true" />
                  Manage Accounts
                </Button>
              }
            />
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
