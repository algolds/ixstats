/**
 * /admin/realms Map: a link per realm to its Atlas page, in place of the old realm picker.
 */
import { fireEvent, render, screen } from "@testing-library/react";

const refetch = jest.fn();
let result: { data?: object[]; isLoading: boolean; error: { message: string } | null } = {
  isLoading: false,
  error: null,
};

jest.mock("~/trpc/react", () => ({
  api: { realms: { adminListRealms: { useQuery: () => ({ ...result, refetch }) } } },
}));

import { RealmMapLinks } from "~/app/admin/realms/_components/map-pipeline/RealmMapLinks";

beforeEach(() => {
  refetch.mockClear();
  result = {
    isLoading: false,
    error: null,
    data: [
      { id: "default", slug: "ixnay", name: "Ixnay" },
      { id: "eurth-id", slug: "eurth", name: "Eurth" },
    ],
  };
});

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

  it("encodes a slug that needs it", () => {
    result.data = [{ id: "r", slug: "new world", name: "New world" }];
    render(<RealmMapLinks />);
    expect(screen.getByRole("link", { name: /New world/ })).toHaveAttribute(
      "href",
      "/admin/maps/realms/new%20world"
    );
  });

  it("asks to create a realm when there are none", () => {
    result.data = [];
    render(<RealmMapLinks />);
    expect(screen.getByText("Create a realm first.")).toBeInTheDocument();
  });

  it("shows the error with a Retry, not the empty message, when the list fails", () => {
    result = { data: undefined, isLoading: false, error: { message: "Realms are down" } };
    render(<RealmMapLinks />);
    expect(screen.getByText("Realms are down")).toBeInTheDocument();
    expect(screen.queryByText("Create a realm first.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
