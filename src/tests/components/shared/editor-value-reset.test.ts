/** @jest-environment node */
import { execSync } from "node:child_process";

/**
 * Assigning `editor.children` bypasses Slate's operations: the new nodes are never rendered, so the next
 * focus or selection sync throws "Cannot resolve a DOM node from Slate node" (the ThinkPages composer
 * broke this way after every post). Values are replaced with `editor.tf.setValue`. jsdom has no real
 * selection, so the failure itself only reproduces in a browser (plans/wikios-v1-tools/plate-repro).
 */
it("never assigns editor.children directly; values go through editor.tf.setValue", () => {
  const hits = execSync(
    String.raw`grep -rnE "\beditor\.children\s*=[^=]" src --include=*.ts --include=*.tsx --exclude-dir=tests || true`,
    { encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean);
  expect(hits).toEqual([]);
});
