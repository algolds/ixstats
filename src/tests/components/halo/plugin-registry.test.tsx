/** Characterizes the Halo plugin registry: which plugin is active and how register/unregister behave. */
import { render } from "@testing-library/react";
import { DIPluginProvider, useActiveDIPlugin, useDIPlugin } from "~/components/halo/plugin-context";
import type { DIPlugin } from "~/components/halo/types";

function Host({ plugin }: { plugin: DIPlugin }) {
  useDIPlugin(plugin);
  return null;
}

function Probe() {
  const active = useActiveDIPlugin();
  return <span data-testid="active">{active?.id ?? "none"}</span>;
}

interface ScenarioProps {
  plugins: Array<DIPlugin | null>;
}

/** Hosts mount in array order; a null entry leaves that slot empty. Probe renders last. */
function Scenario({ plugins }: ScenarioProps) {
  return (
    <DIPluginProvider>
      {plugins.map((plugin, index) =>
        plugin ? <Host key={`slot-${index}`} plugin={plugin} /> : null
      )}
      <Probe />
    </DIPluginProvider>
  );
}

const active = (container: HTMLElement) =>
  container.querySelector('[data-testid="active"]')?.textContent;

describe("Halo plugin registry", () => {
  it("has no active plugin when nothing is registered", () => {
    const { container } = render(<Scenario plugins={[]} />);
    expect(active(container)).toBe("none");
  });

  it("activates the highest priority plugin and falls back when it unmounts", () => {
    const low: DIPlugin = { id: "low", priority: 5 };
    const high: DIPlugin = { id: "high", priority: 10 };
    const { container, rerender } = render(<Scenario plugins={[low, high]} />);
    expect(active(container)).toBe("high");
    rerender(<Scenario plugins={[low, null]} />);
    expect(active(container)).toBe("low");
    rerender(<Scenario plugins={[null, null]} />);
    expect(active(container)).toBe("none");
  });

  it("treats a missing priority as 0", () => {
    const unset: DIPlugin = { id: "unset" };
    const positive: DIPlugin = { id: "positive", priority: 1 };
    const { container } = render(<Scenario plugins={[unset, positive]} />);
    expect(active(container)).toBe("positive");
  });

  it("activates a plugin whose host re-registers it with a higher priority", () => {
    const first: DIPlugin = { id: "first", priority: 10 };
    const second: DIPlugin = { id: "second", priority: 5 };
    const { container, rerender } = render(<Scenario plugins={[first, second]} />);
    expect(active(container)).toBe("first");
    rerender(<Scenario plugins={[first, { id: "second", priority: 100 }]} />);
    expect(active(container)).toBe("second");
  });

  it("gives a priority tie to the first registered plugin", () => {
    const a: DIPlugin = { id: "a", priority: 100 };
    const b: DIPlugin = { id: "b", priority: 100 };
    const { container } = render(<Scenario plugins={[a, b]} />);
    expect(active(container)).toBe("a");
  });

  it("moves a re-registered plugin to the back of a tie", () => {
    // Current behaviour: re-registering deletes and re-inserts, so insertion order changes.
    const a: DIPlugin = { id: "a", priority: 100 };
    const b: DIPlugin = { id: "b", priority: 100 };
    const { container, rerender } = render(<Scenario plugins={[a, b]} />);
    expect(active(container)).toBe("a");
    rerender(<Scenario plugins={[{ id: "a", priority: 100 }, b]} />);
    expect(active(container)).toBe("b");
  });

  it("keeps the newer registration when the older host unmounts", () => {
    const older: DIPlugin = { id: "x", priority: 1 };
    const newer: DIPlugin = { id: "x", priority: 1 };
    const { container, rerender } = render(<Scenario plugins={[older]} />);
    expect(active(container)).toBe("x");
    rerender(<Scenario plugins={[older, newer]} />);
    rerender(<Scenario plugins={[null, newer]} />);
    expect(active(container)).toBe("x");
  });

  it("returns null outside a provider and registering does not throw", () => {
    const plugin: DIPlugin = { id: "orphan", priority: 1 };
    const { container } = render(
      <>
        <Host plugin={plugin} />
        <Probe />
      </>
    );
    expect(active(container)).toBe("none");
  });
});
