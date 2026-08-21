import { NextRequest } from "next/server";
import { GET as getFlag } from "~/app/api/flags/[country]/route";
import { GET as getCache, POST as postCache, DELETE as deleteCache } from "~/app/api/flag-cache/route";
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

  describe("/api/flag-cache Actions", () => {
    test("GET ?action=stats returns stats shape", async () => {
      const req = new NextRequest("http://localhost:3000/api/flag-cache?action=stats");
      const res = await getCache(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json).toHaveProperty("stats");
    });

    test("GET ?action=flags returns batch flag URLs", async () => {
      jest.spyOn(serverFlagResolver, "resolveBatch").mockResolvedValue(
        new Map([
          [
            "Finland",
            {
              countryName: "Finland",
              normalizedName: "finland",
              flagUrl: "https://example.com/finland.svg",
              source: "commons",
              cached: true,
              isPlaceholder: false,
            },
          ],
        ])
      );

      const req = new NextRequest("http://localhost:3000/api/flag-cache?action=flags&countries=Finland");
      const res = await getCache(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.flags["Finland"]).toBe("https://example.com/finland.svg");
    });

    test("POST ?action=update accepts update request", async () => {
      const req = new NextRequest("http://localhost:3000/api/flag-cache?action=update", {
        method: "POST",
        body: JSON.stringify({ countries: ["Sweden", "Norway"] }),
      });
      const res = await postCache(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toContain("started");
    });

    test("DELETE ?action=clear clears all flag caches", async () => {
      const clearSpy = jest.spyOn(serverFlagResolver, "clear").mockResolvedValue(undefined);

      const req = new NextRequest("http://localhost:3000/api/flag-cache?action=clear", {
        method: "DELETE",
      });
      const res = await deleteCache(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(clearSpy).toHaveBeenCalled();
    });
  });
});
