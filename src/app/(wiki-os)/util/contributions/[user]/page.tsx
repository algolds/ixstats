"use client";

import { useParams } from "next/navigation";
import { ContributionsLedger } from "~/components/wiki-os/utilities/ContributionsLedger";

export default function ContributionsPage() {
  const params = useParams<{ user: string }>();

  return (
    <ContributionsLedger
      initialUser={decodeURIComponent(params.user || "")}
      title={(activeUser) => `Contributions: ${activeUser}`}
    />
  );
}
