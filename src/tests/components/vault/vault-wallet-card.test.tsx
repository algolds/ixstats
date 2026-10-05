import React from "react";
import { render } from "@testing-library/react";

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));

import { VaultWalletCard } from "~/components/vault/sections/dashboard/VaultWalletCard";

describe("VaultWalletCard headings", () => {
  it("gives both nested sections an icon heading like the card itself", () => {
    const { container } = render(
      <VaultWalletCard
        reward={null}
        credits={10}
        balanceLoading={false}
        todayEarnings={
          { total: 5, sources: [{ type: "daily", label: "Daily", amount: 5 }] } as never
        }
        treasuryRevenue={{ dailyDividend: 3, weeklyDividend: 21, monthlyDividend: 90 }}
        budgetBonusPercent={2}
      />
    );
    const titles = Array.from(container.querySelectorAll('[data-slot="card-title"]'));
    expect(titles.map((t) => t.textContent)).toEqual([
      "Wallet",
      "Today's earnings",
      "Treasury revenue",
    ]);
    for (const title of titles) expect(title.querySelector("svg")).not.toBeNull();
  });
});
