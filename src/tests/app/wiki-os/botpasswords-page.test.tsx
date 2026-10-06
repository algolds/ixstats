/** Plan 410: Special:BotPasswords lists, creates (showing the password once) and deletes bot passwords. */
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockNotify = { success: jest.fn(), error: jest.fn() };
const invalidate = jest.fn();
const createMutate = jest.fn();
const deleteMutate = jest.fn();
let listResult: { data?: unknown; isLoading: boolean; error: { message: string } | null };
let createOptions: { onSuccess?: (result: { loginName: string; password: string }) => void } = {};

jest.mock("~/hooks/useNotify", () => ({ useNotify: () => mockNotify }));
jest.mock("~/components/wiki-os/shared/WikiOSLayout", () => ({
  WikiOSLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ wikios: { listBotPasswords: { invalidate } } }),
    wikios: {
      listBotPasswords: { useQuery: () => listResult },
      createBotPassword: {
        useMutation: (options: typeof createOptions) => {
          createOptions = options;
          return { mutate: createMutate, isPending: false };
        },
      },
      deleteBotPassword: { useMutation: () => ({ mutate: deleteMutate, isPending: false }) },
    },
  },
}));

import BotPasswordsPage from "~/app/(wiki-os)/util/botpasswords/page";

// Radix's checkbox measures itself with a ResizeObserver, which jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;

const data = {
  wikiUsername: "Heku",
  grants: [
    { grant: "basic", description: "Basic rights (always granted): read pages" },
    { grant: "editpage", description: "Edit existing pages" },
    { grant: "delete", description: "Delete and undelete pages" },
  ],
  botPasswords: [
    { id: "bp1", appId: "Pywikibot", grants: ["basic", "editpage"], createdAt: new Date("2026-09-01T00:00:00Z"), lastUsedAt: null },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  listResult = { data, isLoading: false, error: null };
});

describe("Special:BotPasswords", () => {
  it("lists each bot password with the login name, its grants and when it was last used", () => {
    render(<BotPasswordsPage />);
    expect(screen.getByText("Heku@Pywikibot")).toBeTruthy();
    expect(screen.getAllByText("editpage").length).toBeGreaterThan(0);
    expect(screen.getByText(/never used/)).toBeTruthy();
  });

  it("says why bot passwords are unavailable, for example without a verified wiki link", () => {
    listResult = { data: undefined, isLoading: false, error: { message: "Link and verify your wiki account before creating a bot password." } };
    render(<BotPasswordsPage />);
    expect(screen.getByText(/Link and verify your wiki account/)).toBeTruthy();
    expect(screen.queryByText("Create bot password")).toBeNull();
  });

  it("creates with the chosen grants; basic is always on and cannot be unticked", () => {
    render(<BotPasswordsPage />);
    const basic = screen.getByRole("checkbox", { name: /basic/i }) as HTMLButtonElement;
    expect(basic.getAttribute("aria-checked")).toBe("true");
    expect(basic.disabled || basic.getAttribute("data-disabled") !== null).toBe(true);

    fireEvent.change(screen.getByLabelText("App id"), { target: { value: "AWB" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /edit existing pages/i }));
    fireEvent.click(screen.getByText("Create bot password"));
    expect(createMutate).toHaveBeenCalledWith({ appId: "AWB", grants: ["editpage"] });
  });

  it("shows the new password once, with its login name, and refreshes the list", async () => {
    render(<BotPasswordsPage />);
    act(() => {
      createOptions.onSuccess?.({ loginName: "Heku@AWB", password: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" });
    });
    await waitFor(() => expect(screen.getByText("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBeTruthy());
    expect(screen.getByText("Heku@AWB")).toBeTruthy();
    expect(screen.getByText(/will not be shown again/)).toBeTruthy();
    expect(invalidate).toHaveBeenCalled();
    fireEvent.click(screen.getByText("I have saved it"));
    await waitFor(() => expect(screen.queryByText("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBeNull());
  });

  it("deletes one bot password", () => {
    render(<BotPasswordsPage />);
    fireEvent.click(screen.getByLabelText("Delete Pywikibot"));
    expect(deleteMutate).toHaveBeenCalledWith({ id: "bp1" });
  });
});
