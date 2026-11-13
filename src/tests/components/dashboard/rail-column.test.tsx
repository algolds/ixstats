import { act, render, screen } from "@testing-library/react";
import { RailColumn } from "~/components/dashboard/sections/RailColumn";

type Callback = (entries: { target: Element; intersectionRatio: number }[]) => void;

describe("RailColumn", () => {
  let fire: Callback = () => undefined;

  beforeEach(() => {
    globalThis.IntersectionObserver = class {
      constructor(cb: Callback) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
  });

  it("makes cards that wrap out of view inert and keeps the ones that fit", () => {
    render(
      <RailColumn>
        <p>Realm</p>
        {false}
        <p>Blurb</p>
      </RailColumn>
    );
    const realm = screen.getByText("Realm").parentElement!;
    const blurb = screen.getByText("Blurb").parentElement!;

    act(() =>
      fire([
        { target: realm, intersectionRatio: 1 },
        { target: blurb, intersectionRatio: 0 },
      ])
    );

    expect(realm.inert).toBe(false);
    expect(blurb.inert).toBe(true);
  });
});
