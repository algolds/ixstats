"use client";

import React from "react";
import { motion, easeInOut } from "framer-motion";
import { cn } from "~/lib/utils";
import type { CulturalExchange } from "./cultural-exchange-types";
import { EXCHANGE_TYPES, STATUS_STYLES, getIconAnimation } from "./cultural-exchange-types";
import {
  RiArrowRightLine,
  RiUserLine,
  RiStarLine,
  RiCalendarLine,
  RiGlobalLine,
  RiThumbUpLine,
  RiEditLine,
} from "react-icons/ri";

interface ExchangeCardProps {
  exchange: CulturalExchange;
  index: number;
  isSelected: boolean;
  primaryCountryId: string;
  votedExchanges: Set<string>;
  onClick: () => void;
  onEdit: () => void;
  onVote: (voteType: 'up' | 'down') => void;
}

const ExchangeCard: React.FC<ExchangeCardProps> = React.memo(({
  exchange,
  index,
  isSelected,
  primaryCountryId,
  votedExchanges,
  onClick,
  onEdit,
  onVote,
}) => {
  const typeConfig = EXCHANGE_TYPES[exchange.type];
  const statusConfig = STATUS_STYLES[exchange.status];
  const Icon = typeConfig.icon;

  // Animation configuration based on exchange type
  const getAnimationConfig = (type: string) => {
    switch (type) {
      case 'festival':
        return { particles: 8, pattern: 'confetti', motion: 'float' };
      case 'exhibition':
        return { particles: 3, pattern: 'spotlight', motion: 'sweep' };
      case 'education':
        return { particles: 5, pattern: 'pages', motion: 'flip' };
      case 'cuisine':
        return { particles: 6, pattern: 'steam', motion: 'rise' };
      case 'arts':
        return { particles: 7, pattern: 'splatter', motion: 'splash' };
      case 'sports':
        return { particles: 4, pattern: 'energy', motion: 'pulse' };
      case 'technology':
        return { particles: 10, pattern: 'circuit', motion: 'flow' };
      case 'diplomacy':
        return { particles: 4, pattern: 'waves', motion: 'ripple' };
      case 'music':
        return { particles: 6, pattern: 'notes', motion: 'bounce' };
      case 'film':
        return { particles: 5, pattern: 'frames', motion: 'reel' };
      case 'environmental':
        return { particles: 8, pattern: 'leaves', motion: 'drift' };
      case 'science':
        return { particles: 6, pattern: 'molecules', motion: 'orbit' };
      case 'trade':
        return { particles: 5, pattern: 'arrows', motion: 'traverse' };
      case 'humanitarian':
        return { particles: 4, pattern: 'hearts', motion: 'pulse' };
      case 'agriculture':
        return { particles: 7, pattern: 'seeds', motion: 'grow' };
      case 'heritage':
        return { particles: 5, pattern: 'symbols', motion: 'glow' };
      case 'youth':
        return { particles: 8, pattern: 'stars', motion: 'twinkle' };
      default:
        return { particles: 5, pattern: 'default', motion: 'float' };
    }
  };

  const animConfig = getAnimationConfig(exchange.type);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={cn(
        "group rounded-lg border cursor-pointer transition-all overflow-hidden",
        "bg-white/5 hover:bg-white/10 border-white/10 hover:border-[--intel-gold]/30",
        isSelected && "border-[--intel-gold]/50 bg-[--intel-gold]/10"
      )}
    >
      {/* Exchange Type Banner */}
      <div className={cn(
        "relative h-32 flex items-center justify-between overflow-hidden px-4",
        typeConfig.bgColor, "border-b-2", typeConfig.borderColor
      )}>
        {/* Animated Background Particles */}
        {Array.from({ length: animConfig.particles }).map((_, i) => (
          <motion.div
            key={i}
            className={cn("absolute rounded-full opacity-15", typeConfig.color)}
            style={{
              width: `${3 + Math.random() * 4}px`,
              height: `${3 + Math.random() * 4}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -15, 0],
              x: animConfig.motion === 'drift' ? [0, 8, -4] :
                 animConfig.motion === 'flow' ? [0, 15, 0] : 0,
              opacity: [0.1, 0.2, 0.1],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.15,
              ease: easeInOut
            }}
          />
        ))}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/30 via-transparent to-black/20" />

        {/* Left Side - Host Country */}
        <motion.div
          className="relative z-10 flex items-center gap-3"
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <div className="relative">
            {/* Flag Glow */}
            <motion.div
              className="absolute -inset-2 rounded-xl blur-lg"
              animate={{
                opacity: [0.4, 0.7, 0.4],
                scale: [0.95, 1.05, 0.95],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: easeInOut }}
              style={{ background: `radial-gradient(circle, ${typeConfig.color.replace('text-', '')} 30%, transparent 70%)` }}
            />

            {/* Flag */}
            <motion.div
              className="relative w-20 h-14 rounded-lg overflow-hidden border-2 border-white/40 shadow-2xl"
              whileHover={{ scale: 1.05, rotate: -2 }}
            >
              {exchange.hostCountry.flagUrl ? (
                <img
                  src={exchange.hostCountry.flagUrl}
                  alt={exchange.hostCountry.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">{exchange.hostCountry.name.charAt(0)}</span>
                </div>
              )}
            </motion.div>

            {/* Host Label */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-white text-[9px] font-medium border border-white/20">
                HOST
              </span>
            </div>
          </div>

          <div className="text-left">
            <p className={cn("font-bold text-sm leading-tight drop-shadow-lg", typeConfig.textColor)}>
              {exchange.hostCountry.name}
            </p>
            <p className={cn("text-[10px] font-medium opacity-80", typeConfig.textColor)}>{typeConfig.label}</p>
          </div>
        </motion.div>

        {/* Center - Exchange Icon with Connecting Line */}
        <div className="relative z-10 flex items-center gap-2">
          {/* Left Arrow */}
          <motion.div
            animate={{
              x: [-3, 3, -3],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: easeInOut }}
          >
            <RiArrowRightLine className={cn("h-4 w-4", typeConfig.color)} />
          </motion.div>

          {/* Icon with Emoji */}
          <div
            className={cn(
              "w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-0.5",
              "bg-black/40 backdrop-blur-sm border-2",
              typeConfig.borderColor, "shadow-xl"
            )}
          >
            <motion.span
              className="text-xl leading-none"
              {...getIconAnimation(exchange.type)}
            >
              {typeConfig.emoji}
            </motion.span>
            <Icon className={cn("h-4 w-4", typeConfig.color)} />
          </div>

          {/* Right Arrow */}
          <motion.div
            animate={{
              x: [-3, 3, -3],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: easeInOut, delay: 1 }}
          >
            <RiArrowRightLine className={cn("h-4 w-4", typeConfig.color)} />
          </motion.div>
        </div>

        {/* Right Side - Participant Countries */}
        <motion.div
          className="relative z-10 flex items-center gap-3"
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          <div className="text-right">
            <p className={cn("font-bold text-sm leading-tight drop-shadow-lg", typeConfig.textColor)}>
              {exchange.participatingCountries.length > 0
                ? exchange.participatingCountries[0].name
                : 'Open to All'}
            </p>
            <p className={cn("text-[10px] font-medium opacity-80", typeConfig.textColor)}>
              {exchange.participatingCountries.length > 1
                ? `+${exchange.participatingCountries.length - 1} more`
                : 'Participant'}
            </p>
          </div>

          {exchange.participatingCountries.length > 0 && (
            <div className="relative flex -space-x-3">
              {exchange.participatingCountries.slice(0, 2).map((country, idx) => (
                <motion.div
                  key={country.id}
                  className="relative"
                  initial={{ x: 20 * (idx + 1), opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + idx * 0.1 }}
                >
                  {/* Flag Glow */}
                  <motion.div
                    className="absolute -inset-2 rounded-xl blur-lg"
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                      scale: [0.9, 1.1, 0.9],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: easeInOut, delay: idx * 0.5 }}
                    style={{ background: `radial-gradient(circle, ${typeConfig.color.replace('text-', '')} 30%, transparent 70%)` }}
                  />

                  <motion.div
                    className="relative w-20 h-14 rounded-lg overflow-hidden border-2 border-white/40 shadow-2xl bg-black/20"
                    whileHover={{ scale: 1.05, rotate: 2, zIndex: 10 }}
                  >
                    {country.flagUrl ? (
                      <img
                        src={country.flagUrl}
                        alt={country.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center">
                        <span className="text-white text-lg font-bold">{country.name.charAt(0)}</span>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Status Badge */}
        <motion.div
          className="absolute top-2 right-2 z-20"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
        >
          <div className={cn(
            "px-2 py-0.5 rounded-full text-xs font-bold backdrop-blur-md border bg-black/40",
            statusConfig.bg, statusConfig.color, "border-white/40 shadow-xl"
          )}>
            <span className="mr-1 text-[10px]">{statusConfig.icon}</span>
            <span className="text-[10px]">{statusConfig.label}</span>
          </div>
        </motion.div>
      </div>

      {/* Exchange Content */}
      <div className="p-4">
        {/* Exchange Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex-1">
            <h4 className="font-semibold text-foreground text-sm mb-1">{exchange.title}</h4>
            <p className="text-xs text-[--intel-silver]">{typeConfig.label}</p>
          </div>

          {/* Edit Button - Only show if user owns this exchange */}
          {exchange.hostCountry.id === primaryCountryId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 rounded-lg bg-[--intel-gold]/10 hover:bg-[--intel-gold]/20 border border-[--intel-gold]/30 text-[--intel-gold] transition-colors"
              title="Edit Exchange"
            >
              <RiEditLine className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Exchange Info */}
        <div className="space-y-2">
          <p className="text-[--intel-silver] text-sm line-clamp-2">{exchange.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-[--intel-silver]">
              <div className="flex items-center gap-1">
                <RiUserLine className="h-3 w-3" />
                <span>{exchange.metrics.participants}</span>
              </div>
              <div className="flex items-center gap-1">
                <RiStarLine className="h-3 w-3" />
                <span>{exchange.metrics.culturalImpact}% impact</span>
              </div>
              <div className="flex items-center gap-1">
                <RiCalendarLine className="h-3 w-3" />
                <span>{new Date(exchange.startDate).getFullYear()}</span>
              </div>
            </div>

            {/* Voting Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVote('up');
                }}
                disabled={votedExchanges.has(exchange.id)}
                className={cn(
                  "p-1 rounded transition-colors",
                  votedExchanges.has(exchange.id)
                    ? "text-[--intel-silver] cursor-not-allowed"
                    : "text-green-400 hover:bg-green-500/20"
                )}
              >
                <RiThumbUpLine className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVote('down');
                }}
                disabled={votedExchanges.has(exchange.id)}
                className={cn(
                  "p-1 rounded transition-colors rotate-180",
                  votedExchanges.has(exchange.id)
                    ? "text-[--intel-silver] cursor-not-allowed"
                    : "text-red-400 hover:bg-red-500/20"
                )}
              >
                <RiThumbUpLine className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Participating Countries */}
          <div className="flex items-center gap-2 mt-2">
            <RiGlobalLine className="h-3 w-3 text-[--intel-silver]" />
            <div className="flex items-center gap-1">
              {exchange.participatingCountries.slice(0, 3).map((country) => (
                <div
                  key={country.id}
                  className="w-4 h-3 bg-white/20 rounded border border-white/20 flex items-center justify-center"
                  title={country.name}
                >
                  {country.flagUrl ? (
                    <img
                      src={country.flagUrl}
                      alt={`${country.name} flag`}
                      className="w-full h-full object-cover rounded"
                    />
                  ) : (
                    <span className="text-xs text-foreground">{country.name.charAt(0)}</span>
                  )}
                </div>
              ))}
              {exchange.participatingCountries.length > 3 && (
                <span className="text-xs text-[--intel-silver] ml-1">
                  +{exchange.participatingCountries.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

ExchangeCard.displayName = 'ExchangeCard';

export { ExchangeCard };
