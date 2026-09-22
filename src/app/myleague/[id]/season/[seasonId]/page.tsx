"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { withBasePath } from "~/lib/base-path";
import { Trophy, ArrowLeft } from "iconoir-react";
import { Button } from "~/components/ui/button";

export default function SeasonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params?.id as string;

  useEffect(() => {
    if (leagueId) {
      router.replace(withBasePath(`/myleague/${leagueId}?section=history`));
    }
  }, [leagueId, router]);

  return (
    <div className="container mx-auto max-w-md px-4 py-24 text-center">
      <Trophy className="text-amber-400 mx-auto mb-4 h-12 w-12 animate-pulse" />
      <h2 className="text-foreground text-xl font-bold">Redirecting to Season Archive...</h2>
      <p className="text-muted-foreground mt-2 text-xs">
        Historical standings and roll-of-honor are unified in the league archive.
      </p>
      {leagueId && (
        <Button
          className="mt-6 text-xs font-bold"
          onClick={() => router.replace(withBasePath(`/myleague/${leagueId}?section=history`))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Archive
        </Button>
      )}
    </div>
  );
}
