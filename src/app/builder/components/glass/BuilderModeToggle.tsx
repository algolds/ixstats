"use client";

import React from "react";
import { motion } from "framer-motion";
import { Zap, Settings, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";

interface BuilderModeToggleProps {
  mode: "basic" | "advanced";
  onModeChange: (mode: "basic" | "advanced") => void;
  className?: string;
}

export function BuilderModeToggle({ mode, onModeChange, className }: BuilderModeToggleProps) {
  const toggleMode = () => {
    onModeChange(mode === "basic" ? "advanced" : "basic");
  };

  return (
    <div className={cn("relative", className)}>
      {/* Glass Toggle Container */}
      <motion.div
        className="relative flex items-center rounded-xl border border-white/20 bg-white/10 p-1 shadow-lg backdrop-blur-md"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        {/* Background Slider */}
        <motion.div
          className="absolute top-1 bottom-1 w-1/2 rounded-lg border border-white/30 bg-gradient-to-r from-blue-500/30 to-purple-500/30 backdrop-blur-sm"
          initial={false}
          animate={{
            x: mode === "basic" ? 0 : "100%",
          }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
          }}
        />

        {/* Basic Mode Button */}
        <button
          onClick={() => onModeChange("basic")}
          className={cn(
            "relative z-10 flex items-center gap-2 rounded-lg px-6 py-3 transition-all duration-200",
            mode === "basic" ? "text-white" : "text-white/60 hover:text-white/80"
          )}
        >
          <Zap className="h-4 w-4" />
          <span className="text-sm font-medium">Basic</span>
        </button>

        {/* Advanced Mode Button */}
        <button
          onClick={() => onModeChange("advanced")}
          className={cn(
            "relative z-10 flex items-center gap-2 rounded-lg px-6 py-3 transition-all duration-200",
            mode === "advanced" ? "text-white" : "text-white/60 hover:text-white/80"
          )}
        >
          <Settings className="h-4 w-4" />
          <span className="text-sm font-medium">Advanced</span>
        </button>
      </motion.div>

      {/* Mode Description */}
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-2 text-center"
      >
        <p className="text-xs text-white/60">
          {mode === "basic"
            ? "Essential parameters only - perfect for quick setups"
            : "Full control panel - detailed economic configuration"}
        </p>
      </motion.div>

      {/* Glass Transition Effect */}
      <motion.div
        key={`transition-${mode}`}
        className="pointer-events-none absolute inset-0"
        initial={{
          background:
            "radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%)",
          scale: 0,
        }}
        animate={{
          background: "radial-gradient(circle at center, rgba(255,255,255,0) 0%, transparent 70%)",
          scale: 2,
        }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

export default BuilderModeToggle;
