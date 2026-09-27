/**
 * Content Security Policy — the template is built once at module load and the
 * __NONCE__ placeholder is replaced per request by renderCsp().
 *
 * - script-src carries a per-request nonce. Production still lists 'unsafe-inline'
 *   (browsers ignore it whenever a nonce is present); see plan 335 Step 6 before removing it.
 * - 'unsafe-inline' in style-src is required by many UI libraries.
 * - 'unsafe-eval' is only allowed in development.
 *
 * If Clerk SDK breaks, check: https://clerk.com/docs/security/csp
 */
// oxlint-disable-next-line typescript/no-unused-vars
export function buildCSPTemplate(standalone: boolean): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  // Use nonce-based script-src for both main app and standalone IxWorld
  // strict-dynamic allows scripts with a valid nonce to load additional scripts
  const scriptSrc = isDevelopment
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev`
    : `script-src 'self' 'unsafe-inline' 'nonce-__NONCE__' https://clerk.ixwiki.com https://accounts.ixwiki.com https://*.clerk.accounts.dev https://static.cloudflareinsights.com`;

  const directives = [
    `default-src 'self'`,
    scriptSrc,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https: http:`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `connect-src 'self' https: wss: ws:`,
    `frame-src 'self' https://clerk.ixwiki.com https://accounts.ixwiki.com https://maps.ixwiki.com`,
    `worker-src 'self' blob:`,
    `media-src 'self' https://ixwiki.com data: blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];

  if (isDevelopment) {
    directives.push(`script-src-elem 'self' 'unsafe-inline' https://*.clerk.accounts.dev`);
  }

  return directives.join("; ");
}

/** Fill the per-request nonce into a template from buildCSPTemplate(). */
export function renderCsp(template: string, nonce: string): string {
  return template.replaceAll("__NONCE__", nonce);
}
