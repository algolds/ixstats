import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import type { LogLevel } from "~/components/admin/log-viewer";

/** Maps a stored log level onto the log viewer's four levels. */
export function toLogLevel(dbLevel: string | null | undefined): LogLevel {
  switch (dbLevel?.toUpperCase()) {
    case "DEBUG":
      return "debug";
    case "WARN":
    case "WARNING":
      return "warn";
    case "ERROR":
    case "CRITICAL":
    case "FATAL":
      return "error";
    default:
      return "info";
  }
}

/** A handler that, once the admin confirms, purges the system logs and refetches the list. */
export function useClearSystemLogs(refetch: () => unknown, confirmMessage: string) {
  const notify = useNotify();
  const clearLogs = api.admin.clearSystemLogs.useMutation({
    onSuccess: () => {
      notify.success("System logs cleared successfully");
      void refetch();
    },
    onError: (err) => {
      notify.error(err.message || "Failed to clear logs");
    },
  });
  return () => {
    if (confirm(confirmMessage)) clearLogs.mutate();
  };
}
