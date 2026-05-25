import { useEffect } from "react";
import { toast } from "sonner";

export const useWebGLErrorHandler = () => {
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

        toast.error("Graphics rendering error detected. Please ensure WebGL and hardware acceleration are enabled in your browser settings.", {
          id: "webgl-error-toast",
          duration: 8000,
        });
      }
    };

    const handleContextLost = (event: Event) => {
      console.warn("WebGL context lost, attempting recovery...");
      event.preventDefault();

      // Dispatch event to notify components
      window.dispatchEvent(new CustomEvent("webgl-context-lost"));

      toast.warning("Graphics rendering context lost. Attempting to recover...", {
        id: "webgl-context-lost-toast",
        duration: 5000,
      });
    };

    const handleContextRestored = () => {
      console.log("WebGL context restored");

      // Dispatch event to notify components
      window.dispatchEvent(new CustomEvent("webgl-context-restored"));

      toast.success("Graphics context restored successfully.", {
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
  }, []);
};
