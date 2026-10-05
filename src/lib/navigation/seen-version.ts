/**
 * Which build the user has seen the changelog for. The sidebar's "What's new" row shows while the
 * running build differs from this; opening /changelog marks it seen. The storage key is the one the
 * retired dashboard banner used, so people who already dismissed this build are not shown it again.
 */
import { APP_VERSION, BUILD_VERSION } from "~/lib/buildVersion";

const STORAGE_KEY = "ixstats:version-seen";
/** Same-tab change signal: the `storage` event only fires in other tabs. */
export const VERSION_SEEN_EVENT = "ixstats:version-seen";

export function currentVersionKey(): string {
  return `${APP_VERSION}+${BUILD_VERSION}`;
}

/** The last build marked seen, or null (never seen, or storage is unavailable). */
export function readSeenVersion(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markVersionSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, currentVersionKey());
  } catch {
    // Storage blocked: the flag stays until it can be written, which is harmless.
  }
  window.dispatchEvent(new Event(VERSION_SEEN_EVENT));
}

/** `useSyncExternalStore` subscription for `readSeenVersion` (this tab and other tabs). */
export function subscribeSeenVersion(onChange: () => void): () => void {
  window.addEventListener(VERSION_SEEN_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(VERSION_SEEN_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
