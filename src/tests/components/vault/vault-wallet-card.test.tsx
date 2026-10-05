import React from "react";
import { render } from "@testing-library/react";

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));

import { VaultWalletCard } from "~/components/vault/sections/dashboard/VaultWalletCard";

describe("VaultWalletCard headings", () => {
  it("gives the nested earnings section an icon heading like the card itself", () => {
    const { container } = render(
      <VaultWalletCard
        reward={null}
        credits={10}
        balanceLoading={false}
        todayEarnings={
          { total: 5, sources: [{ type: "daily", label: "Daily", amount: 5 }] } as never
        }
      />
    );
    const titles = Array.from(container.querySelectorAll('[data-slot="card-title"]'));
    expect(titles.map((t) => t.textContent)).toEqual(["Wallet", "Today's earnings"]);
    for (const title of titles) expect(title.querySelector("svg")).not.toBeNull();
  });
});
