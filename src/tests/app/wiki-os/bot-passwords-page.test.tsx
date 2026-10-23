/** Special:BotPasswords: each bot password logs in as `handle@App`, and the old claimed names are named as aliases. */
import { render, screen } from "@testing-library/react";
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});
jest.mock("~/components/wiki-os/admin/AdminPage", () => ({
  AdminPage: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  FormField: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(() => ({ wikios: { listBotPasswords: { invalidate: jest.fn() } } })),
    wikios: {
      listBotPasswords: { useQuery: jest.fn() },
      createBotPassword: { useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })) },
      deleteBotPassword: { useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })) },
    },
  },
}));
import { api } from "~/trpc/react";
import BotPasswordsPage from "~/app/(wiki-os)/util/botpasswords/page";

const row = {
  id: "bp1",
  appId: "Pywikibot",
  grants: ["basic"],
  createdAt: new Date(),
  lastUsedAt: null,
};

function showList(aliases: string[]) {
  jest.mocked(api.wikios.listBotPasswords.useQuery).mockReturnValue({
    data: { handle: "alpha", aliases, grants: [], botPasswords: [row] },
    isLoading: false,
    error: null,
  } as never);
  render(<BotPasswordsPage />);
}

it("labels each bot password with the handle it logs in as, and names the old wiki names that work too", () => {
  showList(["Old name", "Second name"]);
  expect(screen.getByText("alpha@Pywikibot")).toBeTruthy();
  expect(screen.getByText("Your old wiki names work too: Old name, Second name.")).toBeTruthy();
});

it("says nothing about old names to an account without any", () => {
  showList([]);
  expect(screen.getByText("alpha@Pywikibot")).toBeTruthy();
  expect(screen.queryByText(/old wiki names/)).toBeNull();
});
