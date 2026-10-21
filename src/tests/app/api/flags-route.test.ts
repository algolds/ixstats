import { TextDecoder, TextEncoder } from "util";
global.TextDecoder = TextDecoder as any;
global.TextEncoder = TextEncoder as any;

import { NextRequest } from "next/server";
import { GET as getFlag } from "~/app/api/flags/[country]/route";
import { serverFlagResolver } from "~/lib/flags/server";

// Mock auth
jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({
    userId: "user_admin",
    sessionClaims: { metadata: { role: "admin" } },
  }),
}));

describe("Flag API Routes Contracts (Plan 164)", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("GET /api/flags/[country]", () => {
    test("returns 400 when country parameter is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/flags/");
      const res = await getFlag(req, { params: Promise.resolve({ country: "" }) });
      expect(res.status).toBe(400);
    });

    test("returns 200 with standard JSON contract for valid country", async () => {
      jest.spyOn(serverFlagResolver, "resolve").mockResolvedValue({
        countryName: "Estonia",
        normalizedName: "estonia",
        flagUrl: "https://upload.wikimedia.org/estonia.svg",
        source: "commons",
        cached: false,
        isPlaceholder: false,
      });

      const req = new NextRequest("http://localhost:3000/api/flags/Estonia");
      const res = await getFlag(req, { params: Promise.resolve({ country: "Estonia" }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("country", "Estonia");
      expect(json).toHaveProperty("flagUrl", "https://upload.wikimedia.org/estonia.svg");
      expect(json).toHaveProperty("cached", false);
      expect(json).toHaveProperty("isLocal", false);
      expect(json).toHaveProperty("isPlaceholder", false);
      expect(json).toHaveProperty("timestamp");
    });
  });
});
