/**
 * /admin/realms Map: a link per realm to its Atlas page, in place of the old realm picker.
 */
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      adminListRealms: {
        useQuery: () => ({
          data: [
            { id: "default", slug: "ixnay", name: "Ixnay" },
            { id: "eurth-id", slug: "eurth", name: "Eurth" },
          ],
          isLoading: false,
        }),
      },
    },
  },
}));

import { RealmMapLinks } from "~/app/admin/realms/_components/map-pipeline/RealmMapLinks";

describe("RealmMapLinks", () => {
  it("links each realm to its Atlas page", () => {
    render(<RealmMapLinks />);
    expect(screen.getByRole("link", { name: /Ixnay/ })).toHaveAttribute(
      "href",
      "/admin/maps/realms/ixnay"
    );
    expect(screen.getByRole("link", { name: /Eurth/ })).toHaveAttribute(
      "href",
      "/admin/maps/realms/eurth"
    );
  });
});
