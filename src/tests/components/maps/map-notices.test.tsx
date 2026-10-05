import React from "react";
import fs from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";

import * as notices from "~/components/maps/core/components/MapNotices";

describe("MapNotices", () => {
  it("no longer ships the stale maps private-beta notice (AT-17)", () => {
    expect(notices).not.toHaveProperty("BetaNotice");
    const mapsDir = path.join(process.cwd(), "src/components/maps/core");
    const container = fs.readFileSync(path.join(mapsDir, "MapContainer.tsx"), "utf8");
    expect(container).not.toMatch(/BetaNotice|private.beta/i);
  });

  it("keeps the load-error notice", () => {
    const onRetry = jest.fn();
    render(<notices.MapLoadError className="" onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load the map");
    screen.getByRole("button", { name: "Try again" }).click();
    expect(onRetry).toHaveBeenCalled();
  });
});
