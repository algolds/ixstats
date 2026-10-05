import { findAllById, type IdPage } from "~/lib/system/find-all-by-id";

describe("findAllById", () => {
  const rows = Array.from({ length: 1203 }, (_, i) => ({ id: `id${String(i).padStart(5, "0")}` }));
  const fetchPage = jest.fn(async ({ take, cursor, skip = 0 }: IdPage) => {
    const start = cursor ? rows.findIndex((r) => r.id === cursor.id) + skip : 0;
    return rows.slice(start, start + take);
  });

  it("reads past the 1,000-row cap in id-ordered pages", async () => {
    const all = await findAllById(fetchPage, 500);
    expect(all).toHaveLength(1203);
    expect(new Set(all.map((r) => r.id)).size).toBe(1203);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls[1]![0]).toMatchObject({ cursor: { id: "id00499" }, skip: 1 });
  });
});
