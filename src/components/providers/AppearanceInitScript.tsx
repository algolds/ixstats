"use client";

import { useServerInsertedHTML } from "next/navigation";
import { APPEARANCE_INIT_SCRIPT } from "~/lib/design/appearance";

/**
 * The blocking pre-paint script that applies the stored appearance to <html> (Facet 3 spec §7).
 * It is put into the server's HTML head, and is never a React `<script>` element: when the client
 * renders the tree itself instead of hydrating it (Next does for the error shell of a 404 page),
 * React warns that a script it creates never runs. `useServerInsertedHTML` writes it into the
 * server's stream only, with the request's CSP nonce, and does nothing on the client.
 */
export function AppearanceInitScript({ nonce }: { nonce: string | undefined }) {
  useServerInsertedHTML(() => (
    <script nonce={nonce} dangerouslySetInnerHTML={{ __html: APPEARANCE_INIT_SCRIPT }} />
  ));
  return null;
}
