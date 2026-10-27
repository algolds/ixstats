"use client";

import { useSearchParams } from "next/navigation";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { ContributionsLedger } from "~/components/wiki-os/utilities/ContributionsLedger";

export default function ContributionsHubPage() {
  const searchParams = useSearchParams();
  const { user: authUser } = useWikiAuth();

  return (
    <ContributionsLedger
      initialUser={
        searchParams.get("user") || searchParams.get("target") || authUser?.username || ""
      }
      title={() => "User contributions ledger"}
      showEmptyPrompt
    />
  );
}
