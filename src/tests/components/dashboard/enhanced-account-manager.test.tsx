/**
 * The account manager: on the Accounts page the list grows with the page (the modal alone caps it),
 * and activating or deactivating a persona refetches the accounts.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EnhancedAccountManager } from "~/components/dashboard/accounts/EnhancedAccountManager";
import type { ThinkpagesAccountItem } from "~/components/dashboard/accounts/account-types";

const mockInvalidate = jest.fn();
const mockMyPersonasInvalidate = jest.fn();
const mockNotifyError = jest.fn();
const mockReorder = jest.fn();
let mutationOptions: { onSuccess?: () => void } = {};
let reorderPending = false;
let reorderOptions: { onSuccess?: () => Promise<void>; onError?: (e: Error) => void } = {};

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      thinkpages: { getMyAccounts: { invalidate: mockInvalidate } },
      thinkpagesForum: { myPersonas: { invalidate: mockMyPersonasInvalidate } },
    }),
    thinkpages: {
      getAccountLimit: { useQuery: () => ({ data: 25 }) },
      updateAccount: {
        useMutation: (options: { onSuccess?: () => void }) => {
          mutationOptions = options;
          return { mutate: jest.fn() };
        },
      },
      reorderMyAccounts: {
        useMutation: (options: typeof reorderOptions) => {
          reorderOptions = options;
          return { mutate: mockReorder, isPending: reorderPending };
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: mockNotifyError }),
}));
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

/** Opens the card's action menu from the keyboard and returns one of its items. */
async function menuItem(persona: string, name: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: `Actions for Persona ${persona}` }), {
    key: "Enter",
  });
  return screen.findByRole("menuitem", { name });
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

  it("saves the whole order when Move down is chosen from a card menu", async () => {
    renderManager(["a", "b", "c"].map((id) => account(id)));
    fireEvent.click(await menuItem("a", "Move down"));
    expect(mockReorder).toHaveBeenCalledWith({ ids: ["b", "a", "c"] });
    expect(screen.getAllByText(/^@/).map((el) => el.textContent)).toEqual(["@b", "@a", "@c"]);
  });

  it("offers no Move up on the first card", async () => {
    renderManager(["a", "b"].map((id) => account(id)));
    expect(await menuItem("a", "Move up")).toHaveAttribute("aria-disabled", "true");
  });

  it("puts the saved order back and says so when the save fails", async () => {
    renderManager(["a", "b"].map((id) => account(id)));
    fireEvent.click(await menuItem("a", "Move down"));
    act(() => reorderOptions.onError?.(new Error("nope")));
    await waitFor(() =>
      expect(screen.getAllByText(/^@/).map((el) => el.textContent)).toEqual(["@a", "@b"])
    );
    expect(mockNotifyError).toHaveBeenCalledWith("Couldn't save the order", "nope");
  });

  it("refetches the accounts and the forum persona picker after a save", async () => {
    renderManager([account("a")]);
    await act(async () => reorderOptions.onSuccess?.());
    expect(mockInvalidate).toHaveBeenCalled();
    expect(mockMyPersonasInvalidate).toHaveBeenCalled();
  });

  it("disables Move up and Move down while a save is in flight", async () => {
    reorderPending = true;
    try {
      renderManager(["a", "b", "c"].map((id) => account(id)));
      expect(await menuItem("b", "Move up")).toHaveAttribute("aria-disabled", "true");
    } finally {
      reorderPending = false;
    }
  });
});
