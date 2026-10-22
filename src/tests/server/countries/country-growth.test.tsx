/**
 * An admin's growth edit: the editor saves the percent fields as decimals (0.625% is 0.00625, never 62.5% growth),
 * the server schema bounds every field, and the save writes and audits only what changed.
 *
 * Folds country-growth-editor.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { CountryGrowthEditor } from "~/app/admin/_components/CountryGrowthEditor";
import { countryGrowthSchema } from "~/lib/countries/country-growth";
import {
  COUNTRY_GROWTH_UPDATED_ACTION,
  updateCountryGrowth,
} from "~/server/modules/countries/countries.growth";

const admin = { id: "a1", clerkUserId: "clerk_a1" };
const stored = {
  id: "c1",
  name: "Aurelia",
  populationGrowthRate: 0.01,
  adjustedGdpGrowth: 0.03,
  maxGdpGrowthRate: 0.05,
  localGrowthFactor: 1,
};

function setup(country: typeof stored | null = stored) {
  const db = {
    $transaction: jest.fn((cb: (tx: unknown) => unknown): unknown => cb(db)),
    country: {
      findUnique: jest.fn().mockResolvedValue(country),
      update: jest.fn(async ({ data }: { data: object }) => ({ ...stored, ...data })),
    },
    adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return db;
}

describe("countryGrowthSchema", () => {
  it("takes any subset of the growth fields within range", () => {
    expect(countryGrowthSchema.parse({ localGrowthFactor: 1.2 })).toEqual({
      localGrowthFactor: 1.2,
    });
    expect(countryGrowthSchema.safeParse({ populationGrowthRate: 0.5 }).success).toBe(false);
    expect(countryGrowthSchema.safeParse({ maxGdpGrowthRate: -0.01 }).success).toBe(false);
    // 0 would read as 1.0 in the projection (`|| 1.0`), so a factor must be positive.
    expect(countryGrowthSchema.safeParse({ localGrowthFactor: 0 }).success).toBe(false);
    expect(countryGrowthSchema.safeParse({ adjustedGdpGrowth: Infinity }).success).toBe(false);
  });
});

describe("updateCountryGrowth", () => {
  it("writes the changed fields and audits from and to", async () => {
    const db = setup();
    const result = await updateCountryGrowth(db as never, admin, {
      countryId: "c1",
      growth: { populationGrowthRate: 0.02, localGrowthFactor: 1 },
    });
    expect(db.country.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { populationGrowthRate: 0.02 },
      select: expect.any(Object),
    });
    expect(result).toMatchObject({ updated: true, country: { populationGrowthRate: 0.02 } });
    const audit = db.adminAuditLog.create.mock.calls[0]![0].data;
    expect(audit).toMatchObject({
      action: COUNTRY_GROWTH_UPDATED_ACTION,
      targetType: "country",
      targetId: "c1",
      targetName: "Aurelia",
      adminId: "a1",
      adminName: "clerk_a1",
    });
    expect(JSON.parse(audit.changes)).toEqual({
      from: { populationGrowthRate: 0.01 },
      to: { populationGrowthRate: 0.02 },
    });
  });

  it("writes and audits nothing when nothing changes", async () => {
    const db = setup();
    const result = await updateCountryGrowth(db as never, admin, {
      countryId: "c1",
      growth: { adjustedGdpGrowth: 0.03 },
    });
    expect(result?.updated).toBe(false);
    expect(db.country.update).not.toHaveBeenCalled();
    expect(db.adminAuditLog.create).not.toHaveBeenCalled();
  });
});

const mutate = jest.fn();
const editedCountry = {
  id: "c1",
  updatedAt: "2026-10-07T00:00:00Z",
  economicTier: "Strong",
  populationGrowthRate: 0.01,
  adjustedGdpGrowth: 0.03,
  maxGdpGrowthRate: 0.05,
  localGrowthFactor: 1,
};

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      admin: { getCountryDetail: { invalidate: jest.fn() } },
      countries: { getByIdWithEconomicData: { invalidate: jest.fn() } },
    }),
    admin: {
      getCountryDetail: {
        useQuery: () => ({ data: { country: editedCountry }, isLoading: false }),
      },
      updateCountryGrowth: { useMutation: () => ({ mutate, isPending: false }) },
    },
  },
}));

describe("CountryGrowthEditor", () => {
  beforeEach(() => mutate.mockClear());
  it("saves the fields as decimals", () => {
    render(<CountryGrowthEditor countryId="c1" />);
    fireEvent.change(screen.getByLabelText("Population growth (%)"), {
      target: { value: "0.625" },
    });
    fireEvent.change(screen.getByLabelText("Local growth factor (x)"), {
      target: { value: "1.2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save growth" }));
    expect(mutate).toHaveBeenCalledWith({
      countryId: "c1",
      growth: {
        populationGrowthRate: 0.00625,
        adjustedGdpGrowth: 0.03,
        maxGdpGrowthRate: 0.05,
        localGrowthFactor: 1.2,
      },
    });
  });
});
