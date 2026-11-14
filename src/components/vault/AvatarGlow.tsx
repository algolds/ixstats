import React from "react";
import { cn } from "~/lib/utils";
import type { AvatarGlowConfig } from "~/hooks/useActiveCosmetics";
import { CosmeticParticles } from "~/components/vault/CosmeticParticles";

interface AvatarGlowProps {
  avatarGlow: AvatarGlowConfig;
  children: React.ReactNode;
  className?: string;
  roundedClass?: string; // "rounded-full" or "rounded-control-sm"
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
          "border-separator relative flex shrink-0 items-center justify-center border",
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
        "relative flex shrink-0 items-center justify-center transition-[color,background-color,border-color,box-shadow,opacity,scale,translate] duration-300",
        roundedClass,
        isSummer &&
          "border-orange animate-[pulse_1.5s_infinite] border-2 shadow-[0_0_15px_color-mix(in_srgb,var(--color-orange)_55%,transparent)]",
        isEmerald &&
          "border-green animate-[pulse_2s_infinite] border-2 shadow-[0_0_15px_color-mix(in_srgb,var(--color-green)_55%,transparent)]",
        isImperial &&
          "border-yellow animate-[pulse_2.5s_infinite] border-2 shadow-[0_0_20px_color-mix(in_srgb,var(--color-yellow)_55%,transparent)]",
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
          "absolute inset-0 -z-10 animate-[pulse_2s_infinite] opacity-25",
          roundedClass,
          isSummer && "bg-orange",
          isEmerald && "bg-green",
          isImperial && "bg-yellow"
        )}
        style={{
          animationDuration: isSummer ? "1.5s" : isEmerald ? "2s" : "2.5s",
        }}
      />
      {children}
    </div>
  );
}
