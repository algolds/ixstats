"use client";

import { motion } from "motion/react";
import { Lock, Shield, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";

interface VaultStatusIndicatorProps {
  securityLevel?: number; // 0-100
  status?: "secure" | "warning" | "critical" | "locked";
  showLabel?: boolean;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  animated?: boolean;
}

export function VaultStatusIndicator({
  securityLevel = 100,
  status = "secure",
  showLabel = true,
  showPercentage = true,
  size = "md",
  className,
  animated = true,
}: VaultStatusIndicatorProps) {
  // Determine color scheme based on security level and status
  const getStatusConfig = () => {
    if (status === "critical" || securityLevel < 25) {
      return {
        icon: AlertTriangle,
        label: "Critical",
        color: "red",
        gradient: "from-red-400 to-red-600",
        glowClass: "vault-glow-red",
        textColor: "text-red-400",
      };
    }
    if (status === "warning" || securityLevel < 50) {
      return {
        icon: AlertTriangle,
        label: "Warning",
        color: "orange",
        gradient: "from-orange-400 to-orange-600",
        glowClass: "vault-glow-orange",
        textColor: "text-orange-400",
      };
    }
    if (status === "locked") {
      return {
        icon: Lock,
        label: "Locked",
        color: "gold",
        gradient: "from-gold-400 to-gold-600",
        glowClass: "vault-glow-gold",
        textColor: "text-gold-400",
      };
    }
    return {
      icon: securityLevel >= 80 ? CheckCircle : Shield,
      label: securityLevel >= 80 ? "Secure" : "Protected",
      color: "green",
      gradient: "from-green-400 to-green-600",
      glowClass: "vault-glow-gold",
      textColor: "text-gold-400",
    };
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  // Size variants
  const sizeConfig = {
    sm: {
      iconSize: "h-4 w-4",
      barHeight: "h-1",
      padding: "p-2",
      fontSize: "text-xs",
      gap: "gap-2",
    },
    md: {
      iconSize: "h-5 w-5",
      barHeight: "h-1.5",
      padding: "p-3",
      fontSize: "text-xs",
      gap: "gap-3",
    },
    lg: {
      iconSize: "h-6 w-6",
      barHeight: "h-2",
      padding: "p-4",
      fontSize: "text-sm",
      gap: "gap-4",
    },
  }[size];

  return (
    <motion.div
      className={cn(
        "flex items-center rounded-lg bg-black/40 backdrop-blur-md",
        sizeConfig.padding,
        sizeConfig.gap,
        config.glowClass,
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Animated Icon */}
      {animated ? (
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: status === "locked" ? [0, 5, -5, 0] : 0,
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <StatusIcon className={cn(sizeConfig.iconSize, config.textColor)} />
        </motion.div>
      ) : (
        <StatusIcon className={cn(sizeConfig.iconSize, config.textColor)} />
      )}

      {/* Status Label and Progress Bar */}
      <div className="min-w-0 flex-1">
        {showLabel && (
          <p
            className={cn(
              "font-bold tracking-wide uppercase",
              sizeConfig.fontSize,
              config.textColor
            )}
          >
            Vault {config.label}
          </p>
        )}

        {/* Progress bar */}
        <div className={cn("mt-1 overflow-hidden rounded-full bg-black/60", sizeConfig.barHeight)}>
          <motion.div
            className={cn("h-full rounded-full bg-gradient-to-r", config.gradient)}
            initial={{ width: 0 }}
            animate={{ width: `${securityLevel}%` }}
            transition={{
              duration: animated ? 1.5 : 0,
              ease: "easeOut",
              delay: 0.2,
            }}
          >
            {/* Animated shimmer effect */}
            {animated && (
              <motion.div
                className="h-full w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                }}
                animate={{
                  backgroundPosition: ["0% 0%", "200% 0%"],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            )}
          </motion.div>
        </div>
      </div>

      {/* Percentage Display */}
      {showPercentage && (
        <span className={cn("font-black tabular-nums", sizeConfig.fontSize, config.textColor)}>
          {securityLevel}%
        </span>
      )}

      {/* Pulsing indicator for critical states */}
      {(status === "critical" || status === "warning") && animated && (
        <motion.div
          className={cn(
            "absolute -top-1 -right-1 h-3 w-3 rounded-full",
            status === "critical" ? "bg-red-500" : "bg-orange-500"
          )}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [1, 0.5, 1],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </motion.div>
  );
}

/**
 * Compact variant - icon and percentage only
 */
export function VaultStatusIndicatorCompact({
  securityLevel = 100,
  status = "secure",
  className,
}: Pick<VaultStatusIndicatorProps, "securityLevel" | "status" | "className">) {
  const getStatusConfig = () => {
    if (status === "critical" || securityLevel < 25) {
      return {
        icon: AlertTriangle,
        color: "text-red-400",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
      };
    }
    if (status === "warning" || securityLevel < 50) {
      return {
        icon: AlertTriangle,
        color: "text-orange-400",
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/30",
      };
    }
    return {
      icon: Lock,
      color: "text-gold-400",
      bgColor: "bg-gold-500/10",
      borderColor: "border-gold-500/30",
    };
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <motion.div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5",
        config.bgColor,
        config.borderColor,
        className
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <StatusIcon className={cn("h-3.5 w-3.5", config.color)} />
      <span className={cn("text-xs font-black tabular-nums", config.color)}>{securityLevel}%</span>
    </motion.div>
  );
}
