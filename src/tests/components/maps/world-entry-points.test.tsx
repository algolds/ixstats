/**
 * The way into the World tab outside the map: the realm's Manage page (Map section).
 */
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const { createMockMutation, createMockQuery } = jest.requireActual(
    "../../../../jest-mocks/trpc-react"
  );
  return {
    api: {
      useUtils: () => ({ realms: { map: { display: { invalidate: jest.fn() } } } }),
      realms: {
        map: {
          display: {
            useQuery: jest.fn(() =>
              createMockQuery({
                realmId: "r_eurth",
                radiusKm: 6371,
                baseImage: null,
                attribution: null,
                defaultView: null,
                isFounder: true,
              })
            ),
          },
          updateSettings: { useMutation: jest.fn(() => createMockMutation()) },
          recomputeAreas: { useMutation: jest.fn(() => createMockMutation()) },
        },
      },
    },
  };
});
jest.mock("~/app/r/[realm]/_components/manage/RealmImageField", () => ({
  RealmImageField: () => null,
}));

import { MapSection } from "~/app/r/[realm]/_components/manage/MapSection";

describe("Manage, Map", () => {
  it("links to the realm's World tab", () => {
    render(<MapSection slug="eurth" />);
    expect(screen.getByRole("link", { name: "Generate or regenerate the world" })).toHaveAttribute(
      "href",
      "/maps?realm=eurth&editor=world"
    );
  });

  it("encodes a slug that needs it", () => {
    render(<MapSection slug="new world" />);
    expect(screen.getByRole("link", { name: "Generate or regenerate the world" })).toHaveAttribute(
      "href",
      "/maps?realm=new%20world&editor=world"
    );
  });
});
