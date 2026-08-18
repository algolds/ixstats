let handlersRegistered = false;

export function registerNodeProcessErrorHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  process.on("unhandledRejection", (reason) => {
    console.error("[FATAL] Unhandled rejection:", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("[FATAL] Uncaught exception:", err);
  });
}
