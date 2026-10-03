"use client";

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

/** A nation the viewer owns: "Play as" makes it their active nation; "Active" when it already is. */
export function PlayAsNation({
  countryId,
  countryName,
  active,
}: {
  countryId: string;
  countryName: string;
  active: boolean;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const playAs = api.users.setActiveNation.useMutation({
    onSuccess: () => {
      notify.success(`Playing as ${countryName}`, "MyCountry now shows this nation.");
      void utils.users.getProfile.invalidate();
    },
    onError: (error) => notify.error("Could not switch nation", error.message),
  });

  if (active) return <Badge variant="default">Active</Badge>;
  return (
    <Button
      size="xs"
      variant="outline"
      disabled={playAs.isPending}
      onClick={() => playAs.mutate({ countryId })}
    >
      Play as {countryName}
    </Button>
  );
}
