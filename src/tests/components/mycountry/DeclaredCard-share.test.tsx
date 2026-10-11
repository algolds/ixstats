import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/action-links/ShareToRealmButton", () => ({
  ShareToRealmButton: ({ activityId }: { activityId: string }) => (
    <button type="button">Share {activityId}</button>
  ),
}));

import { DeclaredCard } from "~/components/mycountry/shared/primitives/composer/DeclaredCard";

const declared = (activityId: string | null) => ({
  goal: "Create industrial manufacturing jobs",
  res: {
    intent: { changesJson: "[]", tier: "moderate", category: "economy", civCapCost: null },
    changes: [],
    applied: [],
    summary: "",
    activityId,
  } as never,
});

describe("DeclaredCard share", () => {
  it("offers the forum share for a directive that has a public row", () => {
    render(<DeclaredCard declared={declared("dir-1")} onDismiss={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Share dir-1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Declare another" })).toBeInTheDocument();
  });

  it("offers nothing for a directive without one", () => {
    render(<DeclaredCard declared={declared(null)} onDismiss={jest.fn()} />);
    expect(screen.queryByRole("button", { name: /Share/ })).toBeNull();
  });
});
