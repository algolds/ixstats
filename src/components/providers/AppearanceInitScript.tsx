"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { APPEARANCE_INIT_SCRIPT } from "~/lib/design/appearance";

/**
 * The blocking pre-paint script that applies the stored appearance to <html> (Facet 3 spec §7).
 * It is written into the server's HTML, once, in the <head>, and is never a React `<script>`
 * element: when the client renders the tree itself instead of hydrating it (Next does for the error
 * shell of a 404 page), React warns that a script it creates never runs. `useServerInsertedHTML`
 * writes it into the server's stream only, with the request's CSP nonce, and does nothing on the
 * client.
 *
 * Next calls every inserted-HTML callback again for each chunk it flushes and once more at the end
 * of the stream, and writes what they return at that point (the head, the middle of the body, before
 * </body> and after </html>). So the callback answers once and then returns null; the first call
 * is the one for the first chunk, which carries the <head>.
 */
export function AppearanceInitScript({ nonce }: { nonce: string | undefined }) {
  const written = useRef(false);
  useServerInsertedHTML(() => {
    if (written.current) return null;
    written.current = true;
    return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: APPEARANCE_INIT_SCRIPT }} />;
  });
  return null;
}
