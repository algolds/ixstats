"use client";

import React from "react";
import { Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useNotify } from "~/hooks/useNotify";
import { api } from "~/trpc/react";
import { nationalRevenue } from "~/components/mycountry/shell/fiscal/nationalRevenue";

/**
 * Gives a nation with no government departments its form's default departments and budget, so
 * the budget and cabinet first steps can be done. Shown in the National budget tab and the
 * Cabinet's empty state. Sends the nation's revenue (the figure the Economy tabs show), so the
 * new budget starts balanced against it.
 */
export function CreateGovernmentStructureButton({ countryId }: { countryId: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const { data: country } = api.countries.getByIdWithEconomicData.useQuery({ id: countryId });
  const total = country ? nationalRevenue(country).total : null;
  const revenue = total != null && total > 0 ? total : undefined;
  const create = api.government.createStructure.useMutation({
    onSuccess: async (result) => {
      notify.success(`Government structure created with ${result.departments} departments`);
      await Promise.all([
        utils.government.getFullByCountryId.invalidate({ countryId }),
        utils.government.getByCountryId.invalidate({ countryId }),
        utils.mycountry.getFirstSteps.invalidate(),
      ]);
    },
    onError: (error) => notify.error(error.message),
  });

  return (
    <Button
      size="sm"
      onClick={() => create.mutate({ countryId, revenue })}
      disabled={create.isPending}
    >
      <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
      {create.isPending ? "Creating…" : "Create government structure"}
    </Button>
  );
}
