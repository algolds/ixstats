/**
 * "Draft a custom policy" reads the nation's departments from the government structure (the basic
 * country record has none), so a nation with a Finance department can submit a fiscal policy, and
 * a nation without one is told why the buttons are off.
 */
import { fireEvent, render, screen } from "@testing-library/react";

const mockData: Record<string, object | undefined> = {};

jest.mock("~/trpc/react", () => {
  const procedure = (path: string) => ({
    useQuery: () => ({ data: mockData[path], isLoading: false }),
    useMutation: () => ({ mutate: jest.fn(), isPending: false }),
    invalidate: jest.fn(),
  });
  const routerProxy = () =>
    new Proxy(
      {},
      {
        get: (_r, router: string) =>
          new Proxy({}, { get: (_p, proc: string) => procedure(`${router}.${proc}`) }),
      }
    );
  const api = new Proxy(
    {},
    {
      get: (_r, router: string) =>
        router === "useUtils"
          ? routerProxy
          : new Proxy({}, { get: (_p, proc: string) => procedure(`${router}.${proc}`) }),
    }
  );
  return { api };
});
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/context/auth-context", () => ({ useUser: () => ({ user: { id: "u-1" } }) }));

import { PolicyCreatorSheet } from "~/components/executive/PolicyCreatorSheet";

function fillCustomPolicy() {
  fireEvent.change(screen.getByPlaceholderText(/Infrastructure Investment Act/), {
    target: { value: "Fiscal reform" },
  });
  fireEvent.change(screen.getByPlaceholderText(/What the policy does/), {
    target: { value: "Simplify the tax code." },
  });
}

beforeEach(() => {
  for (const key of Object.keys(mockData)) delete mockData[key];
  mockData["countries.getByIdBasic"] = { id: "c-1", name: "Eldoria" };
  mockData["policies.getPolicyReconContext"] = { overCapacity: false, lowEfficiency: false };
});

it("enables submit when the nation has the managing department", () => {
  mockData["government.getByCountryId"] = {
    departments: [{ id: "d-1", name: "Ministry of Finance", category: "Finance" }],
  };
  render(<PolicyCreatorSheet countryId="c-1" open onOpenChange={jest.fn()} />);
  fillCustomPolicy();
  expect(screen.getByRole("button", { name: "Enact policy" })).toBeEnabled();
  expect(screen.getByText("Ministry of Finance")).toBeInTheDocument();
});

it("says why submit is off when the department is missing", () => {
  mockData["government.getByCountryId"] = { departments: [] };
  render(<PolicyCreatorSheet countryId="c-1" open onOpenChange={jest.fn()} />);
  fillCustomPolicy();
  expect(screen.getByRole("button", { name: "Enact policy" })).toBeDisabled();
  expect(screen.getByText(/need a finance department/)).toBeInTheDocument();
});
