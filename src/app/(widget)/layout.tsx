/**
 * Minimal widget layout for forum embeds.
 * No ClerkProvider, Navigation, tRPC client, or Tailwind CSS.
 * This creates an independent layout tree for the (widget) route group.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IxCards Widget",
  robots: "noindex, nofollow",
};

export default function WidgetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: "transparent",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: "#e5e7eb",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {children}
      </body>
    </html>
  );
}
