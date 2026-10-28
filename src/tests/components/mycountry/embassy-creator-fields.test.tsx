/**
 * Stress finding C-27 (browser): the embassy creator's name, location and ambassador labels were not tied to their
 * inputs (no accessible name) and the inputs took any length while the server keeps 120 characters.
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    countries: { getAll: { useQuery: () => ({ data: { countries: [] }, isLoading: false }) } },
    diplomaticEmbassies: {
      establishEmbassy: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/hooks/useActingRealmId", () => ({ useActingRealmId: () => "default" }));

import { EmbassyCreatorSheet } from "~/components/mycountry/domains/diplomacy/EmbassyCreatorSheet";

it("names each field by its label and keeps it within the server's 120 characters", () => {
  render(<EmbassyCreatorSheet countryId="home" countryName="Home" open onOpenChange={() => {}} />);
  for (const label of [/Embassy name/, /Location/, /Ambassador/]) {
    expect(screen.getByLabelText(label)).toHaveAttribute("maxLength", "120");
  }
});
