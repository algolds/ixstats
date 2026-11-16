import { useEffect, useState } from "react";
import type { DIPlugin, PluginCommand } from "./types";

const NONE: readonly PluginCommand[] = [];

/**
 * The active plugin's own search results for `query` (empty while disabled). Hits answer one key (plugin and
 * query), so a newer query never shows an older one's hits: they read as pending until theirs arrive.
 */
export function usePluginSearch(
  plugin: DIPlugin | null | undefined,
  query: string,
  enabled: boolean
): { hits: readonly PluginCommand[]; pending: boolean } {
  const search = enabled ? plugin?.search : undefined;
  const key = search ? `${plugin?.id}\u0000${query}` : null;
  const [answer, setAnswer] = useState<{ key: string; hits: readonly PluginCommand[] } | null>(
    null
  );

  useEffect(() => {
    if (!search || key === null) return;
    let live = true;
    search(query).then(
      (hits) => live && setAnswer({ key, hits }),
      () => live && setAnswer({ key, hits: NONE })
    );
    return () => {
      live = false;
    };
  }, [search, key, query]);

  if (key === null) return { hits: NONE, pending: false };
  return answer?.key === key
    ? { hits: answer.hits, pending: false }
    : { hits: NONE, pending: true };
}
