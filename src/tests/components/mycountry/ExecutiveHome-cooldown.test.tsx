import { act, render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { CooldownTimer } from "~/components/mycountry/shell/ExecutiveHome";

describe("CooldownTimer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2040-01-01T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("counts down every second", () => {
    render(<CooldownTimer cooldownUntil={Date.now() + 65_000} />);
    expect(screen.getByText("1m 5s")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText("1m 4s")).toBeTruthy();
  });
});
