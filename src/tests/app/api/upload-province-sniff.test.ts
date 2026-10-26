/** @jest-environment node */
/** The province upload route takes the file's kind from its bytes: they must be what its name says. */
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
jest.mock("~/server/db", () => ({
  db: {
    svgUpload: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));
jest.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "owner_1" }) }));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => true }));

import type { NextRequest } from "next/server";
import { POST } from "~/app/api/upload-province/route";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 2,
  0, 0, 0, 2, 8, 2, 0, 0, 0,
]);
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path d="M0 0h1v1z"/></svg>';

function upload(file: File) {
  const form = new FormData();
  form.set("file", file);
  form.set("countryId", "c1");
  return POST({ headers: new Headers(), formData: async () => form } as unknown as NextRequest);
}

describe("POST /api/upload-province", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "u1",
      ...data,
    }));
  });

  it.each([
    [SVG, "provinces.png"],
    [PNG, "provinces.svg"],
    ["<html><body>x</body></html>", "provinces.svg"],
  ])("refuses contents that are not what the name says (%#)", async (body, name) => {
    const res = await upload(new File([body], name));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("stores a PNG as base64 and an SVG as text", async () => {
    expect((await upload(new File([PNG], "provinces.png"))).status).toBe(200);
    expect(mockCreate.mock.calls[0]![0].data.svgContent).toBe(Buffer.from(PNG).toString("base64"));
    expect((await upload(new File([SVG], "provinces.svg"))).status).toBe(200);
    expect(mockCreate.mock.calls[1]![0].data.svgContent).toBe(SVG);
  });
});
