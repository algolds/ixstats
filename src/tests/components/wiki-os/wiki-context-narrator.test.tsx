/** A narrator update that changes nothing must not re-render the context consumers. */
import { act, render } from "@testing-library/react";
import { WikiContextProvider, useWikiContext } from "~/components/wiki-os/shared/WikiContext";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

type Ctx = ReturnType<typeof useWikiContext>;

describe("WikiContext setNarratorState", () => {
  it("re-renders a consumer once for repeated identical updates", () => {
    const renders = jest.fn();
    let ctx: Ctx | undefined;
    function Consumer() {
      ctx = useWikiContext();
      renders();
      return null;
    }
    render(
      <WikiContextProvider>
        <Consumer />
      </WikiContextProvider>
    );
    const base = renders.mock.calls.length;

    act(() => ctx?.setNarratorState({ isPlaying: true }));
    expect(renders.mock.calls.length).toBe(base + 1);

    act(() => ctx?.setNarratorState({ isPlaying: true }));
    act(() => ctx?.setNarratorState({ isPlaying: true, speed: 1 }));
    expect(renders.mock.calls.length).toBe(base + 1);
    expect(ctx?.narratorState.isPlaying).toBe(true);

    act(() => ctx?.setNarratorState({ speed: 1.5 }));
    expect(renders.mock.calls.length).toBe(base + 2);
    expect(ctx?.narratorState.speed).toBe(1.5);
  });
});
