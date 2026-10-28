/**
 * useLeaveNotFoundOnQueryChange: the 404 of /wiki/<title> stays up after a client-side navigation that keeps the
 * pathname (the Edit, History and Add topic tabs, `?action=edit&redlink=1`), because Next's not-found boundary resets
 * only on a pathname change. The page loads the new address as a document instead, once its query differs from the
 * one it was shown for.
 */
import { renderHook } from "@testing-library/react";
import { useLeaveNotFoundOnQueryChange } from "~/components/wiki-os/reader/useLeaveNotFoundOnQueryChange";

describe("useLeaveNotFoundOnQueryChange", () => {
  it("does nothing while the query is the one the 404 was shown for", () => {
    const load = jest.fn();
    const { rerender } = renderHook(({ query }) => useLeaveNotFoundOnQueryChange(query, load), {
      initialProps: { query: "" },
    });
    rerender({ query: "" });
    expect(load).not.toHaveBeenCalled();
  });

  it("loads the new address once the query changes (the Edit tab: ?action=edit)", () => {
    const load = jest.fn();
    const { rerender } = renderHook(({ query }) => useLeaveNotFoundOnQueryChange(query, load), {
      initialProps: { query: "" },
    });
    rerender({ query: "action=edit" });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("a 404 first shown with a query reloads only when that query changes", () => {
    const load = jest.fn();
    const { rerender } = renderHook(({ query }) => useLeaveNotFoundOnQueryChange(query, load), {
      initialProps: { query: "redirect=no" },
    });
    rerender({ query: "redirect=no" });
    expect(load).not.toHaveBeenCalled();
    rerender({ query: "action=history" });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
