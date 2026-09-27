/** @jest-environment node */
import { buildCSPTemplate, renderCsp } from "~/lib/security/csp";

describe("CSP template", () => {
  it("renders the per-request nonce into script-src", () => {
    const csp = renderCsp(buildCSPTemplate(false), "abc");
    expect(csp).toContain("'nonce-abc'");
    expect(csp).not.toContain("__NONCE__");
  });

  it("keeps object-src and frame-ancestors locked down", () => {
    const csp = renderCsp(buildCSPTemplate(false), "abc");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
