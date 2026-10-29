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

const mockedCountryId = jest.mocked(getSignedInCountryId);

describe("prefetchMyCountry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("prefetches the profile, the country and its rings for a signed-in player", async () => {
    mockedCountryId.mockResolvedValue("c1");

    await prefetchMyCountry();

    expect(signedInApi.users.getProfile.prefetch).toHaveBeenCalledTimes(1);
    expect(signedInApi.countries.getByIdWithEconomicData.prefetch).toHaveBeenCalledWith({
      id: "c1",
    });
    expect(signedInApi.countries.getActivityRingsData.prefetch).toHaveBeenCalledWith({
      countryId: "c1",
    });
  });

  it("prefetches only the profile for a visitor without a nation", async () => {
    mockedCountryId.mockResolvedValue("");

    await prefetchMyCountry();

    expect(signedInApi.users.getProfile.prefetch).toHaveBeenCalledTimes(1);
    expect(signedInApi.countries.getByIdWithEconomicData.prefetch).not.toHaveBeenCalled();
    expect(signedInApi.countries.getActivityRingsData.prefetch).not.toHaveBeenCalled();
  });
});
