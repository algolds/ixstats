import { useEffect } from "react";
import { useNotify } from "~/hooks/useNotify";

export const useWebGLErrorHandler = () => {
  const notify = useNotify();
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWebGLError = (event: ErrorEvent) => {
      // Check if this is a WebGL-related error
      const isWebGL =
        event.error?.message?.includes("WebGL") ||
        event.error?.message?.includes("THREE") ||
        event.message?.includes("WebGL") ||
        event.message?.includes("THREE");

      if (isWebGL) {
        console.warn("WebGL Error detected:", event.error || event.message);

        // Prevent the error from being logged multiple times
        event.preventDefault();

        // Dispatch a custom event to notify components
        window.dispatchEvent(
          new CustomEvent("webgl-error", {
            detail: { error: event.error?.message || event.message || "WebGL Error" },
          })
        );

        notify.error(
          "Graphics rendering error detected. Please ensure WebGL and hardware acceleration are enabled in your browser settings.",
          undefined,
          { id: "webgl-error-toast", duration: 8000 }
        );
      }
    };

    const handleContextLost = (event: Event) => {
      console.warn("WebGL context lost, attempting recovery...");
      event.preventDefault();

      // Dispatch event to notify components
      window.dispatchEvent(new CustomEvent("webgl-context-lost"));

      notify.warning("Graphics rendering context lost. Attempting to recover...", undefined, {
        id: "webgl-context-lost-toast",
        duration: 5000,
      });
    };

    const handleContextRestored = () => {
      console.log("WebGL context restored");

      // Dispatch event to notify components
      window.dispatchEvent(new CustomEvent("webgl-context-restored"));

      notify.success("Graphics context restored successfully.", undefined, {
        id: "webgl-context-restored-toast",
        duration: 3000,
      });
    };

    // Add global error handlers
    window.addEventListener("error", handleWebGLError);
    window.addEventListener("webglcontextlost", handleContextLost);
    window.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      window.removeEventListener("error", handleWebGLError);
      window.removeEventListener("webglcontextlost", handleContextLost);
      window.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [notify]);
};
