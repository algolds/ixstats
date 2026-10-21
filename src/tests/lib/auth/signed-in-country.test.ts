jest.mock("@clerk/nextjs/server", () => ({ __esModule: true, auth: jest.fn() }));
jest.mock("next/navigation", () => ({ __esModule: true, unstable_rethrow: jest.fn() }));
jest.mock("~/server/db", () => ({ __esModule: true, db: { user: { findUnique: jest.fn() } } }));

import { auth } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";
import { db } from "~/server/db";
import { getSignedInCountryId } from "~/lib/auth/signed-in-country.server";

type AuthResult = Awaited<ReturnType<typeof auth>>;

const authMock = jest.mocked(auth);
const findUniqueMock = jest.mocked(db.user.findUnique);
const rethrowMock = jest.mocked(unstable_rethrow);

function signInAs(userId: string | null) {
  authMock.mockResolvedValue({ userId } as AuthResult);
}

describe("getSignedInCountryId", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns an empty string for guests without touching the database", async () => {
    signInAs(null);
    await expect(getSignedInCountryId()).resolves.toBe("");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
  it("lets Next.js control-flow errors propagate", async () => {
    const nextError = new Error("DYNAMIC_SERVER_USAGE");
    authMock.mockRejectedValue(nextError);
    rethrowMock.mockImplementation((error) => {
      throw error;
    });
    await expect(getSignedInCountryId()).rejects.toBe(nextError);
  });
});
