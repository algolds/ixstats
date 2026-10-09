/**
 * SetupRedirect sends a signed-in user without a nation to /setup, except on pages anyone may read: the forum at
 * /thinkpages and the feed's public post and persona pages under /dashboard. The Dashboard itself stays gated.
 */
import React from "react";
import { render } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: jest.fn(),
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "user_1" }, isLoaded: true }),
}));
jest.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({ user: null, isLoading: false }),
  ROLE_LEVELS: { ADMIN: 10 },
}));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/lib/utils", () => ({ navigateTo: jest.fn() }));
jest.mock("~/trpc/react", () => ({
  api: {
    users: {
      getProfile: {
        useQuery: () => ({ data: { countryId: null }, isLoading: false, error: null }),
      },
    },
  },
}));

import { usePathname } from "next/navigation";
import { navigateTo } from "~/lib/utils";
import { SetupRedirect } from "~/app/_components/SetupRedirect";

const mockPathname = jest.mocked(usePathname);
const mockNavigateTo = jest.mocked(navigateTo);

describe("SetupRedirect", () => {
  beforeEach(() => {
    mockNavigateTo.mockClear();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(["/thinkpages", "/thinkpages/c/general", "/dashboard/post/x", "/dashboard/profile/y"])(
    "lets a user without a nation read %s",
    (path) => {
      mockPathname.mockReturnValue(path);
      render(<SetupRedirect />);
      expect(mockNavigateTo).not.toHaveBeenCalled();
    }
  );

  it.each(["/dashboard", "/dashboard/accounts", "/dashboard/saved"])(
    "sends a user without a nation from %s to setup",
    (path) => {
      mockPathname.mockReturnValue(path);
      render(<SetupRedirect />);
      expect(mockNavigateTo).toHaveBeenCalledWith(expect.anything(), "/setup");
    }
  );
});
