/**
 * Settings: the passport link in the IxnayID panel follows the stored handle only. Another name the status carries (a
 * wiki name may be a hidden claim) never makes the link; with no handle there is no link, and the handle field below
 * asks for one.
 */
import { render, screen } from "@testing-library/react";
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});
jest.mock("~/hooks/useUserCountry", () => ({ useUserCountry: () => ({ userProfile: null }) }));
jest.mock("~/context/auth-context", () => ({ UserButton: () => null }));
jest.mock("~/components/settings/WikiAccountVerifyRow", () => ({
  WikiAccountVerifyRow: () => null,
}));
jest.mock("~/components/settings/WikiNameClaims", () => ({ WikiNameClaims: () => null }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn().mockReturnValue({}),
    ixnayid: {
      getStatus: { useQuery: jest.fn() },
      listWikiLinks: { useQuery: jest.fn().mockReturnValue({ data: [] }) },
      setHandle: {
        useMutation: jest.fn().mockReturnValue({ mutate: jest.fn(), isPending: false }),
      },
      unlinkDiscord: {
        useMutation: jest.fn().mockReturnValue({ mutate: jest.fn(), isPending: false }),
      },
    },
  },
}));
import { api } from "~/trpc/react";
import { AccountIdentityPanel } from "~/app/settings/_components/panels/AccountIdentityPanel";

const statusWith = (handle: string | null) => ({
  passportHandle: handle ?? "Hidden Name",
  handle,
  canChangeHandle: true,
  forum: { linked: true, username: "Forum Name" },
  wiki: { linked: true, username: "Hidden Name" },
  discord: { linked: false },
});

function renderWith(handle: string | null) {
  jest
    .mocked(api.ixnayid.getStatus.useQuery)
    .mockReturnValue({ data: statusWith(handle) } as never);
  render(<AccountIdentityPanel user={{ username: "clerk_name" } as never} />);
}

const linkTargets = () => screen.queryAllByRole("link").map((a) => a.getAttribute("href"));

it("links the passport at the stored handle", () => {
  renderWith("kir");
  expect(screen.getByRole("link", { name: /view public passport/i })).toHaveAttribute(
    "href",
    "/@kir"
  );
  expect(screen.getByRole("button", { name: /copy link/i })).toBeEnabled();
  expect(screen.getAllByText("@kir").length).toBeGreaterThan(0);
});

it("with no handle shows no passport link and never the wiki name, and the handle field asks for one", () => {
  renderWith(null);
  expect(screen.queryByRole("link", { name: /view public passport/i })).toBeNull();
  expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();
  expect(linkTargets().filter((href) => href?.startsWith("/@"))).toEqual([]);
  expect(screen.queryByText(/Hidden Name/)).toBeNull();
  expect(screen.getAllByText("No handle yet").length).toBeGreaterThan(0);
  expect(screen.getByRole("textbox", { name: "New passport handle" })).toBeEnabled();
});
