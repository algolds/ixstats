"use client";

import React from "react";
import { useParams } from "next/navigation";
import { SportsFocusProvider } from "~/components/sports/core/SportsFocusProvider";
import { ClubRouter } from "~/components/sports/club/ClubRouter";

export default function MyClubPage() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : "";

  return (
    <SportsFocusProvider>
      <ClubRouter teamId={teamId} />
    </SportsFocusProvider>
  );
}
