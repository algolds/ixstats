import type { ReactNode } from "react";
import { claimableNation } from "~/lib/realms/claimable-nation";

const mockMutate = jest.fn();
let mockSignedIn = true;
let mockRules: { summary: string } | null = null;

global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("~/context/auth-context", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: mockSignedIn }),
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    realms: {
      region: { overview: { useQuery: () => ({ data: { rules: mockRules } }) } },
      claimCountry: { useMutation: () => ({ mutate: mockMutate, isPending: false }) },
    },
    useUtils: () => ({
      realms: {
        myClaims: { invalidate: jest.fn() },
        getBySlug: { invalidate: jest.fn() },
        myNations: { invalidate: jest.fn() },
      },
      users: { getProfile: { invalidate: jest.fn() } },
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSignedIn = true;
  mockRules = null;
});
describe("claimableNation", () => {
  const base = {
    id: "c1",
    name: "Bainbridge_Islands",
    owner: null,
    realm: { slug: "eurth", status: "active" },
  };

  it("is claimable when unowned in an open realm other than Ixnay", () => {
    expect(claimableNation(base)).toEqual({ countryId: "c1", countryName: "Bainbridge Islands" });
  });

  it("is not claimable when owned, in Ixnay, or in a closed realm", () => {
    expect(claimableNation({ ...base, owner: { id: "u" } })).toBeNull();
    expect(claimableNation({ ...base, ownerUserId: "u" })).toBeNull();
    expect(claimableNation({ ...base, realm: { slug: "ixnay", status: "active" } })).toBeNull();
    expect(claimableNation({ ...base, realm: { slug: "eurth", status: "archived" } })).toBeNull();
    expect(claimableNation({ ...base, realm: null })).toBeNull();
  });

  it("is not claimable when the founder reserved it as scenery, and is when it is open or says nothing", () => {
    expect(claimableNation({ ...base, claimable: false })).toBeNull();
    expect(claimableNation({ ...base, claimable: true })).toEqual({
      countryId: "c1",
      countryName: "Bainbridge Islands",
    });
    // a record from before the column was read keeps its claim button
    expect(claimableNation({ ...base, claimable: undefined })).not.toBeNull();
  });
});
