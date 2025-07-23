"use client";
import { useWebGLErrorHandler } from "~/hooks/use-webgl-error-handler";

export const WebGLErrorHandler = () => {
  useWebGLErrorHandler();
  return null; // This component doesn't render anything
}; 