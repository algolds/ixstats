import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/cards/useWorkshop", () => ({ useDust: jest.fn() }));

import { useDust } from "~/hooks/cards/useWorkshop";
import { DustBalances } from "~/components/vault/cards/DustBalances";

describe("DustBalances", () => {
  it("shows the total and each realm's dust", () => {
    jest.mocked(useDust).mockReturnValue({
      data: [
        { realmId: "default", realmName: "Ixnay", realmSlug: "ixnay", balance: 1200 },
        { realmId: "iiwiki", realmName: "IIWiki", realmSlug: "iiwiki", balance: 45 },
      ],
    } as never);
    render(<DustBalances />);
    fireEvent.click(screen.getByRole("button", { name: "Dust: 1,245" }));
    expect(screen.getByRole("list", { name: "Dust by realm" })).toBeTruthy();
    expect(screen.getByText("Ixnay")).toBeTruthy();
    expect(screen.getByText("1,200")).toBeTruthy();
    expect(screen.getByText("45")).toBeTruthy();
    expect(screen.getByText("Dust crafts cards from its own realm.")).toBeTruthy();
  });

  it("says how to get dust when there is none", () => {
    jest.mocked(useDust).mockReturnValue({ data: [] } as never);
    render(<DustBalances />);
    fireEvent.click(screen.getByRole("button", { name: "Dust: 0" }));
    expect(screen.getByText("No dust yet. Break down copies you don't need.")).toBeTruthy();
  });

  it("shows no total until the balances arrive", () => {
    jest.mocked(useDust).mockReturnValue({ data: undefined } as never);
    render(<DustBalances />);
    expect(screen.queryByRole("button", { name: /Dust/ })).toBeNull();
  });
});
