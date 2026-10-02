"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Group as Users, Plus, ArrowRight } from "iconoir-react";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { shellPageTitleProps } from "~/components/shell/ShellPageHeader";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { EnhancedAccountManager } from "./EnhancedAccountManager";
import { AccountCreationModal } from "./AccountCreationModal";
import { AccountSettingsModal } from "./AccountSettingsModal";

interface ThinkPagesAccountHubProps {
  /** Country id resolved on the server, used until getProfile loads so the country query runs in parallel. */
  initialCountryId?: string;
}

function ThinkPagesAccountHubInner({ initialCountryId = "" }: ThinkPagesAccountHubProps) {
  const { user } = useUser();

  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<any>(null);

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const effectiveCountryId: string = (userProfile ? userProfile.countryId : initialCountryId) || "";

  const { data: countryData } = api.countries.getMapSummary.useQuery(
    { countryId: effectiveCountryId },
    {
      enabled: !!effectiveCountryId && effectiveCountryId.trim() !== "",
      staleTime: 5 * 60_000,
      retry: false,
    }
  );

  const { data: accountsData } = api.thinkpages.getMyAccounts.useQuery(undefined, {
    enabled: !!user?.id,
  });

  const accounts = useMemo(() => accountsData || [], [accountsData]);

  useEffect(() => {
    // oxlint-disable-next-line
    if (!selectedAccount && accounts.length > 0) setSelectedAccount(accounts[0]);
  }, [accounts, selectedAccount]);

  const isCountryReady =
    userProfile &&
    countryData &&
    userProfile.countryId?.trim() &&
    countryData.id?.trim() &&
    countryData.name?.trim();

  if (!isCountryReady) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <FacetCard>
          <EmptyState
            icon={<Users />}
            title="Country Setup Required"
            message="You need a country to create ThinkPages accounts."
            action={
              <Button asChild>
                <Link href={"/setup"}>Complete Setup</Link>
              </Button>
            }
          />
        </FacetCard>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Feed redirect banner */}
      <FacetCard padding="md" className="flex items-center justify-between gap-4">
        <div>
          <p className="text-headline text-label">The social feed has moved to your Dashboard</p>
          <p className="text-footnote text-label-secondary">
            Post, browse, and interact from the unified feed.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={"/dashboard"}>
            Go to Dashboard
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </FacetCard>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {/* Phones under the new shell get the ShellPageHeader title instead. */}
          <h1 {...shellPageTitleProps} className="text-title-2 text-label">
            ThinkPages Accounts
          </h1>
          <p className="text-body text-label-secondary">
            Manage your personas — government officials, media outlets, and citizen voices.
          </p>
        </div>
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAccountCreation(true);
          }}
          type="button"
        >
          <Plus aria-hidden="true" />
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

export function ThinkPagesAccountHub({ initialCountryId }: ThinkPagesAccountHubProps) {
  return (
    <AuthenticationGuard redirectPath="/thinkpages">
      <ThinkPagesAccountHubInner initialCountryId={initialCountryId} />
    </AuthenticationGuard>
  );
}
