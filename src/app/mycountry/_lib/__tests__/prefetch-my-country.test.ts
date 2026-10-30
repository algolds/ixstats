import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getSignedInCountryId } from "~/lib/auth/signed-in-country.server";
import { signedInApi } from "~/trpc/server";
import { prefetchMyCountry } from "../prefetch-my-country";

jest.mock("~/trpc/server", () => ({
  signedInApi: {
    users: { getProfile: { prefetch: jest.fn().mockResolvedValue(undefined) } },
    countries: {
      getByIdWithEconomicData: { prefetch: jest.fn().mockResolvedValue(undefined) },
      getActivityRingsData: { prefetch: jest.fn().mockResolvedValue(undefined) },
    },
  },
}));
jest.mock("~/lib/auth/signed-in-country.server");
jest.mock("next/headers", () => ({ cookies: jest.fn() }));
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));

const mockedCountryId = jest.mocked(getSignedInCountryId);

describe("prefetchMyCountry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(cookies).mockResolvedValue({ get: () => undefined } as never);
    jest.mocked(auth).mockResolvedValue({ userId: "user_1" } as never);
  });

  it("prefetches the profile, the country and its rings for a signed-in player", async () => {
    mockedCountryId.mockResolvedValue("c1");

    await prefetchMyCountry();

    expect(signedInApi.users.getProfile.prefetch).toHaveBeenCalledTimes(1);
    expect(signedInApi.countries.getByIdWithEconomicData.prefetch).toHaveBeenCalledWith(
      { id: "c1" },
      expect.anything()
    );
    expect(signedInApi.countries.getActivityRingsData.prefetch).toHaveBeenCalledWith(
      { countryId: "c1" },
      expect.anything()
    );
  });

  it("makes one attempt per read, so a failing read cannot hold up the page with retries", async () => {
    mockedCountryId.mockResolvedValue("c1");

    await prefetchMyCountry();

    expect(signedInApi.users.getProfile.prefetch).toHaveBeenCalledWith(undefined, { retry: false });
    expect(signedInApi.countries.getByIdWithEconomicData.prefetch).toHaveBeenCalledWith(
      { id: "c1" },
      { retry: false }
    );
    expect(signedInApi.countries.getActivityRingsData.prefetch).toHaveBeenCalledWith(
      { countryId: "c1" },
      { retry: false }
    );
  });

  it("prefetches nothing for a signed-out visitor", async () => {
    mockedCountryId.mockResolvedValue("");
    jest.mocked(auth).mockResolvedValue({ userId: null } as never);

    await prefetchMyCountry();

    expect(signedInApi.users.getProfile.prefetch).not.toHaveBeenCalled();
    expect(signedInApi.countries.getByIdWithEconomicData.prefetch).not.toHaveBeenCalled();
    expect(signedInApi.countries.getActivityRingsData.prefetch).not.toHaveBeenCalled();
  });

  it("prefetches only the profile for a visitor without a nation", async () => {
    mockedCountryId.mockResolvedValue("");

    await prefetchMyCountry();

    expect(signedInApi.users.getProfile.prefetch).toHaveBeenCalledTimes(1);
    expect(signedInApi.countries.getByIdWithEconomicData.prefetch).not.toHaveBeenCalled();
    expect(signedInApi.countries.getActivityRingsData.prefetch).not.toHaveBeenCalled();
  });

  it("prefetches nothing while play-as is active", async () => {
    mockedCountryId.mockResolvedValue("c1");
    jest.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === "ixstats_play_as" ? { name, value: "1" } : undefined),
    } as never);

    await prefetchMyCountry();

    expect(signedInApi.users.getProfile.prefetch).not.toHaveBeenCalled();
    expect(signedInApi.countries.getByIdWithEconomicData.prefetch).not.toHaveBeenCalled();
    expect(signedInApi.countries.getActivityRingsData.prefetch).not.toHaveBeenCalled();
  });
});
