/**
 * Native lore plan Task 5: a tab's way into the lore writer. The writer checks no access itself, so it opens only for
 * a viewer who may write, whatever calls it; each opening carries its seed or the piece to edit, and closing clears it.
 */
import { act, renderHook } from "@testing-library/react";
import { useLoreEntry } from "~/hooks/lore/useLoreEntry";

let mockAccess: { enabled: boolean; isOwner: boolean; canWrite: boolean } | undefined;
const mockAccessQuery = jest.fn();

jest.mock("~/trpc/react", () => ({
  api: {
    countryLore: {
      access: {
        useQuery: (input: object) => {
          mockAccessQuery(input);
          return { data: mockAccess };
        },
      },
    },
  },
}));

beforeEach(() => {
  mockAccessQuery.mockClear();
});

describe("useLoreEntry", () => {
  it("never opens the writer for a viewer who may not write, nor while access is unknown", () => {
    for (const access of [undefined, { enabled: true, isOwner: false, canWrite: false }]) {
      mockAccess = access;
      const { result } = renderHook(() => useLoreEntry("c_caph"));
      act(() => result.current.write({ type: "place", title: "Venceia" }));
      act(() => result.current.edit("Venceia"));
      expect(result.current.canWrite).toBe(false);
      expect(result.current.isOwner).toBe(false);
      expect(result.current.writer.open).toBe(false);
    }
    expect(mockAccessQuery).toHaveBeenCalledWith({ countryId: "c_caph" });
  });

  it("opens on a seed or on a piece to edit for a writer, and closes", () => {
    mockAccess = { enabled: true, isOwner: true, canWrite: true };
    const { result } = renderHook(() => useLoreEntry("c_caph"));
    expect(result.current.isOwner).toBe(true);
    act(() => result.current.write({ type: "event", title: "Founding", date: "480 BC" }));
    expect(result.current.writer).toEqual(
      expect.objectContaining({
        open: true,
        seed: { type: "event", title: "Founding", date: "480 BC" },
        editTitle: undefined,
      })
    );
    act(() => result.current.writer.onClose());
    expect(result.current.writer.open).toBe(false);
    act(() => result.current.edit("Venceia"));
    expect(result.current.writer).toEqual(
      expect.objectContaining({ open: true, seed: undefined, editTitle: "Venceia" })
    );
  });
});
