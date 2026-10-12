/**
 * The two ways into the World tab outside the map: the realm's Manage page (Map section) and the admin studio.
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
      geoCore: { getMapStats: { useQuery: jest.fn(() => createMockQuery(null)) } },
    },
  };
});
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ actions }: { actions: React.ReactNode }) => <div>{actions}</div>,
}));
jest.mock("~/components/maps/editor/panels/EditQueuePanel", () => ({ EditQueuePanel: () => null }));
jest.mock("~/app/admin/maps/_components/MapSettingsTab", () => ({ MapSettingsTab: () => null }));
jest.mock("~/app/admin/maps/_components/PipelineWizard", () => ({ PipelineWizard: () => null }));
jest.mock("next/dynamic", () => () => () => null);
jest.mock("~/app/r/[realm]/_components/manage/RealmImageField", () => ({
  RealmImageField: () => null,
}));

import { MapSection } from "~/app/r/[realm]/_components/manage/MapSection";
import AdminMapsPage from "~/app/admin/maps/WorldStudioPanel";

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

describe("the admin studio", () => {
  it("links to the editor's sandbox next to the world editor", () => {
    render(<AdminMapsPage />);
    expect(screen.getByRole("link", { name: "Studio" })).toHaveAttribute(
      "href",
      "/admin/maps/editor?sandbox=1"
    );
    expect(screen.getByRole("link", { name: "Open world editor" })).toHaveAttribute(
      "href",
      "/admin/maps/editor"
    );
  });
});
