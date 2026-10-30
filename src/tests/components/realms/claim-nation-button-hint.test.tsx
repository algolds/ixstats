/**
 * The claim dialog tells a player who already holds a nation in the realm that a claim adds to their nations and
 * leaves the one they act as alone, and links the help on playing more than one nation. A first claim says nothing.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { CLAIM_ADDS_TO_HOLDINGS } from "~/lib/realms/claimable-nation";

let ownedNations: Array<{ id: string }> = [];

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({}),
    realms: {
      region: {
        overview: {
          useQuery: () => ({ data: { rules: null, viewer: { ownedNations } }, isLoading: false }),
        },
      },
      claimCountry: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
    },
  },
}));
jest.mock("~/context/auth-context", () => ({ useAuth: () => ({ isSignedIn: true }) }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({}) }));
jest.mock("~/components/realms/use-invite-via", () => ({ useInviteVia: () => null }));

import { ClaimNationButton } from "~/components/realms/ClaimNationButton";

const openDialog = () => {
  render(<ClaimNationButton realmSlug="eurth" countryId="c1" countryName="Aurelia" />);
  fireEvent.click(screen.getByRole("button", { name: "Claim" }));
};

describe("ClaimNationButton hint", () => {
  it("tells a holder their active nation stays, with the help link", () => {
    ownedNations = [{ id: "c0" }];
    openDialog();
    expect(screen.getByText(CLAIM_ADDS_TO_HOLDINGS, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/help/world/realms#playing-more-than-one-nation"
    );
  });

  it("says nothing of it on a first claim", () => {
    ownedNations = [];
    openDialog();
    expect(screen.queryByText(CLAIM_ADDS_TO_HOLDINGS, { exact: false })).toBeNull();
  });
});
