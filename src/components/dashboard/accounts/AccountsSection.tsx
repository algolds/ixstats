"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Group as Users, Plus, ArrowLeft, BookmarkBook } from "iconoir-react";
import { EmptyState } from "~/components/ui/empty-state";
import { Button } from "~/components/ui/button";
import { shellPageTitleProps } from "~/components/shell/ShellPageHeader";
import { useUser } from "~/context/auth-context";
import { api, type RouterOutputs } from "~/trpc/react";
import { AuthenticationGuard } from "~/components/mycountry/primitives";
import { EnhancedAccountManager } from "./EnhancedAccountManager";
import { AccountCreationModal } from "./AccountCreationModal";
import { AccountSettingsModal } from "./AccountSettingsModal";
import { Card } from "~/components/ui/card";

type ThinkpagesAccountItem = RouterOutputs["thinkpages"]["getMyAccounts"][number];

interface AccountsSectionProps {
  /** Country id resolved on the server, used until getProfile loads so the country query runs in parallel. */
  initialCountryId?: string;
  /** Returns to the Dashboard feed; without it there is no Feed button. */
  onBack?: () => void;
}

function AccountsSectionInner({ initialCountryId = "", onBack }: AccountsSectionProps) {
  const { user } = useUser();

  const [selectedAccount, setSelectedAccount] = useState<ThinkpagesAccountItem | null>(null);
  const [showAccountCreation, setShowAccountCreation] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [settingsAccount, setSettingsAccount] = useState<ThinkpagesAccountItem | null>(null);

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
      // DashboardColumn supplies the page padding; the card keeps a readable measure.
      <div className="mx-auto max-w-3xl space-y-6">
        {/* The page's h1 while there is no section header (the shell header names it on phones). */}
        <h1 {...shellPageTitleProps} className="sr-only">
          Accounts
        </h1>
        <Card>
          <EmptyState
            icon={<Users />}
            title="Country setup required"
            message="You need a country to create ThinkPages accounts."
            action={
              <Button asChild>
                <Link href={"/setup"}>Complete setup</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {/* Phones under the new shell get the ShellPageHeader title instead. */}
          <h1 {...shellPageTitleProps} className="text-title-2 text-label">
            Accounts
          </h1>
          <p className="text-body text-label-secondary">
            Manage your personas: government officials, media outlets and citizen voices.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onBack && (
            <Button size="sm" variant="ghost" type="button" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              Feed
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard/saved">
              <BookmarkBook aria-hidden="true" />
              Saved posts
            </Link>
          </Button>
          <Button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowAccountCreation(true);
            }}
            type="button"
          >
            <Plus aria-hidden="true" />
            New account
          </Button>
        </div>
      </div>

      <EnhancedAccountManager
        accounts={accounts}
        selectedAccount={selectedAccount}
        onAccountSelect={setSelectedAccount}
        onAccountSettings={(account: ThinkpagesAccountItem) => {
          setSettingsAccount(account);
          setShowAccountSettings(true);
        }}
        onCreateAccount={() => setShowAccountCreation(true)}
        isOwner
      />

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

export function AccountsSection({ initialCountryId, onBack }: AccountsSectionProps) {
  return (
    <AuthenticationGuard redirectPath="/dashboard/accounts">
      <AccountsSectionInner initialCountryId={initialCountryId} onBack={onBack} />
    </AuthenticationGuard>
  );
}
