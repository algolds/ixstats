/** @jest-environment node */
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    militaryEquipmentCatalog: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  })),
}));

import { resolveEquipmentImage } from "~/server/services/wikimedia-equipment-image-resolver";

const STORED = "https://example.org/curated.jpg";

describe("resolveEquipmentImage", () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("keeps a stored image that still loads, however old, and writes nothing", async () => {
    mockFindUnique.mockResolvedValue({
      id: "e1",
      name: "M1 Abrams",
      category: "tank",
      imageUrl: STORED,
      updatedAt: new Date("2020-01-01"),
    });
    fetchMock.mockResolvedValue(
      new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } })
    );

    const result = await resolveEquipmentImage("e1");

    expect(result).toMatchObject({ success: true, imageUrl: STORED, cached: true });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.every(([url]) => String(url) === STORED)).toBe(true);
  });
});
