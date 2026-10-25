/**
 * P2-13 copy: the lift confirm names the target as it is displayed and its verb agrees ("The sanctions on E2E
 * Bravoland end now."), not "Sanctions on e2e bravoland ends now."
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

let mockActive: unknown[] = [];

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/trpc/react", () => {
  const query = () => ({ useQuery: () => ({ data: [], isLoading: false, error: null }) });
  const mutation = { useMutation: () => ({ mutate: jest.fn(), isPending: false }) };
  return {
    api: {
      useUtils: () => ({}),
      diplomaticPolicies: {
        getForeignPolicyProposals: query(),
        getAllianceInvites: query(),
        getOutgoingForeignPolicyProposals: query(),
        getOutgoingAllianceInvites: query(),
        getActiveForeignPolicies: {
          useQuery: () => ({ data: mockActive, isLoading: false, error: null }),
        },
        respondToForeignPolicyProposal: mutation,
        respondToAllianceInvite: mutation,
        withdrawForeignPolicyProposal: mutation,
        withdrawAllianceInvite: mutation,
        liftForeignPolicyAction: mutation,
      },
    },
  };
});

import { DiplomacyInbox } from "~/components/mycountry/domains/diplomacy/inbox/DiplomacyInbox";
import { liftConfirmSentence } from "~/components/mycountry/domains/diplomacy/inbox/useDiplomacyInbox";

it("agrees the verb with each action and keeps the display name", () => {
  expect(liftConfirmSentence("sanction", "E2E Bravoland")).toBe(
    "The sanctions on E2E Bravoland end now."
  );
  expect(liftConfirmSentence("embargo", "Upper_Nambia")).toBe(
    "The trade embargo on Upper Nambia ends now."
  );
  expect(liftConfirmSentence("blockade", null)).toBe("The blockade on the other nation ends now.");
});

it("asks to lift a sanction in plain, correctly cased copy", () => {
  mockActive = [
    {
      id: "fp1",
      initiatorId: "c1",
      actionType: "sanction",
      target: { name: "E2E Bravoland" },
      expiresAt: new Date(Date.now() + 86_400_000 * 30).toISOString(),
    },
  ];
  render(<DiplomacyInbox countryId="c1" />);
  fireEvent.click(screen.getByRole("button", { name: "Lift: Sanctions On E2E Bravoland" }));
  const text = screen.getByRole("alertdialog").textContent ?? "";
  expect(text).toContain("The sanctions on E2E Bravoland end now.");
  expect(text).not.toMatch(/e2e bravoland/);
});
