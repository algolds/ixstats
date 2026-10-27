"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useDebounce } from "~/hooks/useDebounce";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Input } from "~/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

export type NameEvidence = RouterOutputs["admin"]["searchLegacyWikiNames"][number];
type LinkTarget = RouterOutputs["admin"]["findNameLinkTargets"][number];

const MAX_NAME_QUERY = 85;
const MAX_ACCOUNT_QUERY = 64;

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** An account as admins know it: its handle, else its Clerk id. */
export const accountLabel = (account: { handle: string | null; clerkUserId: string }) =>
  account.handle ? `@${account.handle}` : account.clerkUserId;

/** A name's evidence on one line. `claimantId` keeps a claim's own approval from reading as another holder. */
export function evidenceLine(evidence: NameEvidence, claimantId?: string): string {
  const { lorewards, owner } = evidence;
  const parts = [count(evidence.wikiosEdits, "WikiOS edit")];
  if (evidence.classicEdits !== null) parts.push(count(evidence.classicEdits, "classic edit"));
  if (lorewards) {
    parts.push(
      `${lorewards.dailyWins} daily · ${lorewards.weeklyWins} weekly · ${lorewards.monthlyWins} monthly wins`
    );
  }
  if (evidence.importedGroups.length > 0) {
    parts.push(`Groups: ${evidence.importedGroups.join(", ")}`);
  }
  if (evidence.blocked) parts.push("Blocked");
  if (owner && owner.userId !== claimantId) {
    parts.push(`Held by ${owner.handle ? `@${owner.handle}` : "another account"}`);
  }
  return parts.join(" · ");
}

interface LinkLegacyNameSheetProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

/** The direct link: find an old IxWiki name by its evidence, pick the account it belongs to, and link them. */
export function LinkLegacyNameSheet({ open, onOpenChange }: LinkLegacyNameSheetProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [nameQuery, setNameQuery] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [name, setName] = useState<NameEvidence | null>(null);
  const [account, setAccount] = useState<LinkTarget | null>(null);
  const [note, setNote] = useState("");

  const nameSearch = useDebounce(nameQuery.trim(), 300);
  const accountSearch = useDebounce(accountQuery.trim(), 300);
  const names = api.admin.searchLegacyWikiNames.useQuery(
    { query: nameSearch, limit: 20 },
    { enabled: nameSearch.length > 0 }
  );
  const accounts = api.admin.findNameLinkTargets.useQuery(
    { query: accountSearch },
    { enabled: name !== null && accountSearch.length > 0 }
  );

  const close = (next: boolean) => {
    if (!next) {
      setNameQuery("");
      setAccountQuery("");
      setName(null);
      setAccount(null);
      setNote("");
    }
    onOpenChange(next);
  };
  const link = api.admin.linkLegacyWikiName.useMutation({
    onSuccess: () => {
      void utils.admin.listNameClaims.invalidate();
      close(false);
    },
    onError: (err) => notify.error(err.message),
  });

  const submit = () => {
    if (!name || !account) return;
    link.mutate({
      userId: account.userId,
      name: name.name,
      note: note.trim() || null,
      mwUserId: null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="flex flex-col gap-5 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Link an old name</SheetTitle>
          <SheetDescription>Find the IxWiki name, then the account it belongs to.</SheetDescription>
        </SheetHeader>

        <Input
          value={nameQuery}
          onChange={(e) => setNameQuery(e.target.value)}
          aria-label="Search wiki names"
          placeholder="Wiki user name"
          maxLength={MAX_NAME_QUERY}
        />
        {nameSearch.length > 0 && (
          <FacetList>
            <FacetListSection aria-label="Wiki names">
              {(names.data ?? []).map((found) => (
                <FacetRow
                  key={found.name}
                  title={found.name}
                  subtitle={evidenceLine(found)}
                  accessory="check"
                  selected={name?.name === found.name}
                  onClick={() => setName(found)}
                />
              ))}
              {names.data?.length === 0 && <FacetRow title="No wiki names match" />}
            </FacetListSection>
          </FacetList>
        )}

        {name && (
          <>
            <Input
              value={accountQuery}
              onChange={(e) => setAccountQuery(e.target.value)}
              aria-label="Search accounts"
              placeholder="Handle, country or Clerk id"
              maxLength={MAX_ACCOUNT_QUERY}
            />
            {accountSearch.length > 0 && (
              <FacetList>
                <FacetListSection aria-label="Accounts">
                  {(accounts.data ?? []).map((target) => (
                    <FacetRow
                      key={target.userId}
                      title={accountLabel(target)}
                      subtitle={target.countryName}
                      accessory="check"
                      selected={account?.userId === target.userId}
                      onClick={() => setAccount(target)}
                    />
                  ))}
                  {accounts.data?.length === 0 && <FacetRow title="No accounts match" />}
                </FacetListSection>
              </FacetList>
            )}
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Link note"
              placeholder="Optional: why this name is theirs"
              maxLength={1000}
            />
          </>
        )}

        <SheetFooter className="mt-auto">
          {name && account && (
            <p className="text-footnote text-label-secondary">
              {name.name} joins {accountLabel(account)}
            </p>
          )}
          <Button onClick={submit} disabled={!name || !account || link.isPending}>
            {link.isPending ? "Linking..." : "Link name"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
