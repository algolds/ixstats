"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Users, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { EnhancedAccountManager } from "./EnhancedAccountManager";
import { AccountCreationModal } from "./AccountCreationModal";
import { AccountSettingsModal } from "./AccountSettingsModal";
import { createUrl } from "~/lib/url-utils";

function ThinkPagesAccountHubInner() {
  const { user } = useUser();

  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<any>(null);

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const { data: countryData } = api.countries.getMapSummary.useQuery(
    { countryId: userProfile?.countryId || "" },
    { enabled: !!userProfile?.countryId && userProfile.countryId.trim() !== "", staleTime: 5 * 60_000, retry: false }
  );

  const { data: accountsData } = api.thinkpages.getMyAccounts.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  const accounts = useMemo(() => accountsData || [], [accountsData]);

  useEffect(() => {
    if (!selectedAccount && accounts.length > 0) setSelectedAccount(accounts[0]);
  }, [accounts, selectedAccount]);

  const isCountryReady =
    userProfile && countryData &&
    userProfile.countryId?.trim() &&
    countryData.id?.trim() &&
    countryData.name?.trim();

  if (!isCountryReady) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">Country Setup Required</h3>
            <p className="mb-4 text-sm text-muted-foreground">
              You need a country to create ThinkPages accounts.
            </p>
            <Link href={"/setup"}>
              <Button>Complete Setup</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Feed redirect banner */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              The social feed has moved to your Dashboard
            </p>
            <p className="text-xs text-muted-foreground">
              Post, browse, and interact from the unified feed.
            </p>
          </div>
          <Link href={"/dashboard"}>
            <Button size="sm" variant="outline" className="gap-1.5">
              Go to Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">ThinkPages Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage your personas — government officials, media outlets, and citizen voices.
          </p>
        </div>
        <Button
          onClick={() => setShowAccountCreation(true)}
          className="gap-1.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-700 hover:to-violet-700"
        >
          <Plus className="h-4 w-4" />
          New Account
        </Button>
      </div>

      {/* Account Manager */}
      <EnhancedAccountManager
        countryId={countryData.id}
        accounts={accounts}
        selectedAccount={selectedAccount}
        onAccountSelect={setSelectedAccount}
        onAccountSettings={(account: any) => {
          setSettingsAccount(account);
          setShowAccountSettings(true);
        }}
        onCreateAccount={() => setShowAccountCreation(true)}
        isOwner
      />

      {/* Modals */}
      {showAccountCreation && (
        <AccountCreationModal
          countryId={countryData.id}
          countryName={countryData.name}
          existingAccountCount={accounts.length}
          isOpen={showAccountCreation}
          onClose={() => setShowAccountCreation(false)}
          onAccountCreated={() => setShowAccountCreation(false)}
        />
      )}
      {showAccountSettings && settingsAccount && (
        <AccountSettingsModal
          account={settingsAccount}
          isOpen={showAccountSettings}
          onClose={() => {
            setShowAccountSettings(false);
            setSettingsAccount(null);
          }}
          onAccountUpdate={() => {
            setShowAccountSettings(false);
            setSettingsAccount(null);
          }}
        />
      )}
    </div>
  );
}

export function ThinkPagesAccountHub() {
  return (
    <AuthenticationGuard redirectPath="/thinkpages">
      <ThinkPagesAccountHubInner />
    </AuthenticationGuard>
  );
}
