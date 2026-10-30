/**
 * The account manager: on the Accounts page the list grows with the page (the modal alone caps it),
 * and activating or deactivating a persona refetches the accounts.
 */
import { render, screen } from "@testing-library/react";
import { EnhancedAccountManager } from "~/components/dashboard/accounts/EnhancedAccountManager";
import type { ThinkpagesAccountItem } from "~/components/dashboard/accounts/account-types";

const mockInvalidate = jest.fn();
let mutationOptions: { onSuccess?: () => void } = {};

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ thinkpages: { getMyAccounts: { invalidate: mockInvalidate } } }),
    thinkpages: {
      getAccountLimit: { useQuery: () => ({ data: 25 }) },
      updateAccount: {
        useMutation: (options: { onSuccess?: () => void }) => {
          mutationOptions = options;
          return { mutate: jest.fn() };
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({ success: jest.fn() }) }));
// The real PreText measures text with an ESM-only library Jest does not transform.
jest.mock("~/components/ui/pretext", () => ({
  PreText: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

function account(id: string): ThinkpagesAccountItem {
  return {
    id,
    username: id,
    displayName: `Persona ${id}`,
    accountType: "citizen",
    isActive: true,
    verified: false,
    postCount: 0,
    followerCount: 0,
    bio: null,
    profileImageUrl: null,
  } as ThinkpagesAccountItem;
}

function renderManager(accounts: ThinkpagesAccountItem[], inModal?: boolean) {
  return render(
    <EnhancedAccountManager
      accounts={accounts}
      selectedAccount={null}
      onAccountSelect={jest.fn()}
      onAccountSettings={jest.fn()}
      onCreateAccount={jest.fn()}
      isOwner
      inModal={inModal}
    />
  );
}

/** The scroll container that holds the account cards. */
const listOf = (username: string) => screen.getByText(`@${username}`).closest(".space-y-2");

describe("EnhancedAccountManager", () => {
  it("lets the list grow on the page and caps it only in the modal", () => {
    const accounts = ["a", "b", "c", "d"].map((id) => account(id));
    const { unmount } = renderManager(accounts);
    expect(listOf("a")?.className).not.toContain("max-h-80");
    unmount();

    renderManager(accounts, true);
    expect(listOf("a")?.className).toContain("max-h-80");
  });

  it("refetches the accounts after a visibility change", () => {
    renderManager([account("a")]);
    mutationOptions.onSuccess?.();
    expect(mockInvalidate).toHaveBeenCalled();
  });
});
