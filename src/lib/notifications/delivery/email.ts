/**
 * Email sender for notification delivery (SL-5): one POST to an HTTP email API in Resend's JSON
 * shape (`{ from, to, subject, text, html }` with a bearer key). No SDK dependency.
 */
import type { EmailConfig } from "./config";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string | Uint8Array }
) => Promise<{ ok: boolean; status: number }>;

/** Sends one email; resolves false (never throws) when the API refuses it or is unreachable. */
export async function sendEmail(
  config: EmailConfig,
  message: EmailMessage,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<boolean> {
  try {
    const res = await fetchImpl(config.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!res.ok) console.warn(`[NotificationEmail] Email API answered ${res.status}`);
    return res.ok;
  } catch (error) {
    console.warn("[NotificationEmail] Email API unreachable:", error);
    return false;
  }
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}
