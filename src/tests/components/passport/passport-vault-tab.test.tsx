/**
 * The passport Vault tab's collector-level bar uses the vault's configured XP per level.
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { PassportVaultTab } from "~/components/passport/tabs/PassportVaultTab";
import type { PassportVault } from "~/components/passport/types";

jest.mock("~/components/cards/display/CardDisplay", () => ({ CardDisplay: () => null }));
jest.mock("~/components/cards/display/CardDetailsModal", () => ({ CardDetailsModal: () => null }));

const vault: PassportVault = {
  totalCards: 4,
  deckValue: 0,
  collectorLevel: 3,
  collectorXp: 1200,
  xpPerLevel: 500,
  credits: 0,
  focus: null,
  topCards: [],
};

describe("PassportVaultTab", () => {
  it("measures progress against the configured XP per level", () => {
    render(<PassportVaultTab vault={vault} cleanUsername="alex" />);
    expect(screen.getByText("1,200 / 1,500 XP")).toBeTruthy();
  });
});
