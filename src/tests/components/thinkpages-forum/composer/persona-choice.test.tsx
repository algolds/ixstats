import { renderHook, act } from "@testing-library/react";

const query = { data: undefined as object | undefined };
jest.mock("~/trpc/react", () => ({
  api: { thinkpagesForum: { myPersonas: { useQuery: () => query } } },
}));

import {
  useMyPersonas,
  usePersonaChoice,
} from "~/components/thinkpages-forum/composer/PersonaSelect";

const cached = {
  personas: [{ id: "p1", displayName: "Aria", username: "aria" }],
  lastUsedPersonaId: "p1",
};

describe("useMyPersonas", () => {
  beforeEach(() => {
    query.data = cached;
  });
  it("returns the member's personas and last used one where in-character posting is allowed", () => {
    expect(renderHook(() => useMyPersonas(true)).result.current).toEqual(cached);
  });
  it("returns no personas and no last used one when disabled, even with cached data", () => {
    expect(renderHook(() => useMyPersonas(false)).result.current).toEqual({
      personas: [],
      lastUsedPersonaId: null,
    });
  });
});

describe("usePersonaChoice", () => {
  it("follows the last used persona, including one that arrives after the first render", () => {
    const { result, rerender } = renderHook(({ last }) => usePersonaChoice(last), {
      initialProps: { last: null as string | null },
    });
    expect(result.current[0]).toBeNull();
    rerender({ last: "p1" });
    expect(result.current[0]).toBe("p1");
  });
  it("keeps a chosen persona over a later last used one", () => {
    const { result, rerender } = renderHook(({ last }) => usePersonaChoice(last), {
      initialProps: { last: null as string | null },
    });
    act(() => result.current[1]("p2"));
    rerender({ last: "p1" });
    expect(result.current[0]).toBe("p2");
  });
  it("keeps an explicit yourself instead of falling back to the last used persona", () => {
    const { result, rerender } = renderHook(({ last }) => usePersonaChoice(last), {
      initialProps: { last: "p1" as string | null },
    });
    act(() => result.current[1](null));
    rerender({ last: "p1" });
    expect(result.current[0]).toBeNull();
  });
});
