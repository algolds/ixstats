import React from "react";
import { cn } from "~/lib/utils";
import type { AvatarGlowConfig } from "~/hooks/useActiveCosmetics";
import { CosmeticParticles } from "~/components/vault/CosmeticParticles";

interface AvatarGlowProps {
  avatarGlow: AvatarGlowConfig;
  children: React.ReactNode;
  className?: string;
  roundedClass?: string; // "rounded-full" or "rounded-sm"
}

export function AvatarGlow({
  avatarGlow,
  children,
  className,
  roundedClass = "rounded-full",
}: AvatarGlowProps) {
  if (!avatarGlow.enabled) {
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center border border-white/20",
          roundedClass,
          className
        )}
      >
        {children}
      </div>
    );
  }

  const isSummer = avatarGlow.style === "summer";
  const isEmerald = avatarGlow.style === "emerald";
  const isImperial = avatarGlow.style === "imperial";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center transition-all duration-300",
        roundedClass,
        isSummer &&
          "animate-[pulse_1.5s_infinite] border-2 border-orange-500 shadow-[0_0_15px_#f97316]",
        isEmerald &&
          "animate-[pulse_2s_infinite] border-2 border-emerald-500 shadow-[0_0_15px_#10b981]",
        isImperial &&
          "animate-[pulse_2.5s_infinite] border-2 border-amber-500 shadow-[0_0_20px_#eab308]",
        !isSummer && !isEmerald && !isImperial && "border",
        className
      )}
      style={
        !isSummer && !isEmerald && !isImperial
          ? {
              boxShadow: `0 0 ${avatarGlow.intensity || "15px"} ${avatarGlow.color}`,
              borderColor: avatarGlow.color,
            }
          : undefined
      }
    >
      {/* Background particles */}
      {avatarGlow.style && (
        <CosmeticParticles
          style={avatarGlow.style}
          containerType="glow"
          className="rounded-[inherit]"
        />
      )}
      {/* Background radial aura ring */}
      <span
        className={cn(
          "absolute inset-0 -z-10 animate-ping opacity-25",
          roundedClass,
          isSummer && "bg-orange-500",
          isEmerald && "bg-emerald-500",
          isImperial && "bg-amber-500"
        )}
        style={{
          animationDuration: isSummer ? "1.5s" : isEmerald ? "2s" : "2.5s",
        }}
      />
      {children}
    </div>
  );
}
