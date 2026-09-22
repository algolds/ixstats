"use client";

import React from "react";
import { useParams } from "next/navigation";
import { SportsFocusProvider } from "~/components/sports/core/SportsFocusProvider";
import { LeagueRouter } from "~/components/sports/league/LeagueRouter";

export default function LeagueDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <SportsFocusProvider>
      <LeagueRouter leagueId={id} />
    </SportsFocusProvider>
  );
}
