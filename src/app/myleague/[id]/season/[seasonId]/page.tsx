"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trophy, ArrowLeft } from "iconoir-react";
import { Button } from "~/components/ui/button";

export default function SeasonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params?.id as string;

  useEffect(() => {
    if (leagueId) {
      router.replace(`/myleague/${leagueId}?section=history`);
    }
  }, [leagueId, router]);

  return (
    <div className="container mx-auto max-w-md px-4 py-24 text-center">
      <Trophy className="text-yellow mx-auto mb-4 size-12" aria-hidden />
      <h2 className="text-label text-title-2">Redirecting to Season Archive...</h2>
      <p className="text-label-secondary text-footnote mt-2">
        Historical standings and roll-of-honor are unified in the league archive.
      </p>
      {leagueId && (
        <Button
          className="mt-6"
          onClick={() => router.replace(`/myleague/${leagueId}?section=history`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Archive
        </Button>
      )}
    </div>
  );
}
