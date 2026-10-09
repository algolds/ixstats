/**
 * The feed's account manager dialog links to the Dashboard's Accounts section when the host
 * passes onManageAccounts.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/dashboard/accounts/EnhancedAccountManager", () => ({
  EnhancedAccountManager: () => null,
}));

import { AccountManagerModal } from "~/components/dashboard/accounts/AccountManagerModal";

const baseProps = {
  isOpen: true,
  accounts: [],
  selectedAccount: null,
  onAccountSelect: () => {},
  onAccountSettings: () => {},
  onCreateAccount: () => {},
  isOwner: true,
};

describe("AccountManagerModal", () => {
  it("closes and opens the Accounts section from Manage accounts", () => {
    const calls: string[] = [];
    render(
      <AccountManagerModal
        {...baseProps}
        onClose={() => calls.push("close")}
        onManageAccounts={() => calls.push("manage")}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Manage accounts" }));
    expect(calls).toEqual(["close", "manage"]);
  });

  it("has no Manage accounts link without a handler", () => {
    render(<AccountManagerModal {...baseProps} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Manage accounts" })).not.toBeInTheDocument();
  });
});
