/** Settings: the player's old IxWiki names, the form to ask for one and the switch that shows each. */
import { fireEvent, render, screen } from "@testing-library/react";
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    ixnayid: {
      listMyNameClaims: { useQuery: jest.fn() },
      requestNameClaim: { useMutation: jest.fn() },
      setNameClaimVisibility: { useMutation: jest.fn() },
    },
  },
}));
import { api } from "~/trpc/react";
import { WikiNameClaims } from "~/components/settings/WikiNameClaims";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

const claim = (id: string, name: string, status: Status, extra: object = {}) => ({
  id,
  userId: "p1",
  name,
  status,
  visible: true,
  rightsPass: false,
  origin: "PLAYER",
  evidence: null,
  decisionNote: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  decidedAt: null,
  ...extra,
});

const requestMutate = jest.fn();
const visibilityMutate = jest.fn();

function renderWith(claims: object[]) {
  jest
    .mocked(api.ixnayid.listMyNameClaims.useQuery)
    .mockReturnValue({ data: claims, isLoading: false } as never);
  jest
    .mocked(api.ixnayid.requestNameClaim.useMutation)
    .mockReturnValue({ mutate: requestMutate, isPending: false } as never);
  jest
    .mocked(api.ixnayid.setNameClaimVisibility.useMutation)
    .mockReturnValue({ mutate: visibilityMutate, isPending: false } as never);
  jest
    .mocked(api.useUtils)
    .mockReturnValue({ ixnayid: { listMyNameClaims: { invalidate: jest.fn() } } } as never);
  render(<WikiNameClaims />);
}

beforeEach(() => jest.clearAllMocks());

it("shows each claim's state and a rejected claim's decision note", () => {
  renderWith([
    claim("c1", "Old name", "PENDING"),
    claim("c2", "Wrong name", "REJECTED", { decisionNote: "Another player made these edits" }),
  ]);
  expect(screen.getByText("Old name")).toBeInTheDocument();
  expect(screen.getByText("Waiting for review")).toBeInTheDocument();
  expect(screen.getByText("Not approved")).toBeInTheDocument();
  expect(screen.getByText("Another player made these edits")).toBeInTheDocument();
  expect(screen.getByRole("switch", { name: "Show Old name on my passport" })).toBeInTheDocument();
  expect(screen.queryByRole("switch", { name: "Show Wrong name on my passport" })).toBeNull();
});

it("shows the private signal only while a pending or approved claim is hidden", () => {
  renderWith([
    claim("c1", "Shown", "APPROVED"),
    claim("c2", "Hidden but gone", "REVOKED", { visible: false }),
  ]);
  expect(screen.queryByText("Private until you confirm")).toBeNull();
  jest.clearAllMocks();
  document.body.innerHTML = "";
  renderWith([claim("c1", "Hidden", "APPROVED", { visible: false })]);
  expect(screen.getByText("Private until you confirm")).toBeInTheDocument();
});

it("shows only the form when there are no claims", () => {
  renderWith([]);
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.getByLabelText("Old IxWiki name")).toHaveAttribute("placeholder", "Wiki user name");
});

it("asks for a name, sending a blank note as null", () => {
  renderWith([]);
  fireEvent.change(screen.getByLabelText("Old IxWiki name"), { target: { value: "Old name" } });
  fireEvent.change(screen.getByLabelText("How we can tell it is yours"), {
    target: { value: "   " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask to add" }));
  expect(requestMutate).toHaveBeenCalledWith({ name: "Old name", evidence: null });
});

it("turns a hidden name on", () => {
  renderWith([claim("c1", "Hidden", "PENDING", { visible: false })]);
  fireEvent.click(screen.getByRole("switch", { name: "Show Hidden on my passport" }));
  expect(visibilityMutate).toHaveBeenCalledWith({ claimId: "c1", visible: true });
});
