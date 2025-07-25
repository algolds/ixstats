"use client";
import { motion } from "framer-motion";
import React from "react";

export const LoaderOne = () => {
  const transition = (x: number) => {
    return {
      duration: 1,
      repeat: Infinity,
      repeatType: "loop" as const,
      delay: x * 0.2,
      ease: "easeInOut",
    };
  };
  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: [0, 10, 0],
        }}
        transition={transition(0)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
      />
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: [0, 10, 0],
        }}
        transition={transition(1)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
      />
      <motion.div
        initial={{
          y: 0,
        }}
        animate={{
          y: [0, 10, 0],
        }}
        transition={transition(2)}
        className="h-4 w-4 rounded-full border border-neutral-300 bg-gradient-to-b from-neutral-400 to-neutral-300"
      />
    </div>
  );
};

export const LoaderTwo = () => {
  const transition = (x: number) => {
    return {
      duration: 2,
      repeat: Infinity,
      repeatType: "loop" as const,
      delay: x * 0.2,
      ease: "easeInOut",
    };
  };
  return (
    <div className="flex items-center">
      <motion.div
        transition={transition(0)}
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        className="h-4 w-4 rounded-full bg-neutral-200 shadow-md dark:bg-neutral-500"
      />
      <motion.div
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        transition={transition(0.4)}
        className="h-4 w-4 -translate-x-2 rounded-full bg-neutral-200 shadow-md dark:bg-neutral-500"
      />
      <motion.div
        initial={{
          x: 0,
        }}
        animate={{
          x: [0, 20, 0],
        }}
        transition={transition(0.8)}
        className="h-4 w-4 -translate-x-4 rounded-full bg-neutral-200 shadow-md dark:bg-neutral-500"
      />
    </div>
  );
};

export const LoaderThree = () => {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-20 w-20 stroke-neutral-500 [--fill-final:var(--color-yellow-300)] [--fill-initial:var(--color-neutral-50)] dark:stroke-neutral-100 dark:[--fill-final:var(--color-yellow-500)] dark:[--fill-initial:var(--color-neutral-800)]"
    >
      <motion.path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <motion.path
        initial={{ pathLength: 0, fill: "var(--fill-initial)" }}
        animate={{ pathLength: 1, fill: "var(--fill-final)" }}
        transition={{
          duration: 2,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        }}
        d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"
      />
    </motion.svg>
  );
};

export const LoaderFour = ({ text = "Loading..." }: { text?: string }) => {
  return (
    <div className="relative font-bold text-black [perspective:1000px] dark:text-white">
      <motion.span
        animate={{
          skew: [0, -40, 0],
          scaleX: [1, 2, 1],
        }}
        transition={{
          duration: 0.05,
          repeat: Infinity,
          repeatType: "reverse",
          repeatDelay: 2,
          ease: "linear",
          times: [0, 0.2, 0.5, 0.8, 1],
        }}
        className="relative z-20 inline-block"
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute inset-0 text-[#00e571]/50 blur-[0.5px] dark:text-[#00e571]"
        animate={{
          x: [-2, 4, -3, 1.5, -2],
          y: [-2, 4, -3, 1.5, -2],
          opacity: [0.3, 0.9, 0.4, 0.8, 0.3],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear",
          times: [0, 0.2, 0.5, 0.8, 1],
        }}
      >
        {text}
      </motion.span>
      <motion.span
        className="absolute inset-0 text-[#8b00ff]/50 dark:text-[#8b00ff]"
        animate={{
          x: [0, 1, -1.5, 1.5, -1, 0],
          y: [0, -1, 1.5, -0.5, 0],
          opacity: [0.4, 0.8, 0.3, 0.9, 0.4],
        }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "linear",
          times: [0, 0.3, 0.6, 0.8, 1],
        }}
      >
        {text}
      </motion.span>
    </div>
  );
};

export const LoaderFive = ({ text }: { text: string }) => {
  return (
    <div className="font-sans font-bold [--shadow-color:var(--color-neutral-500)] dark:[--shadow-color:var(--color-neutral-100)]">
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{
            scale: [1, 1.1, 1],
            textShadow: [
              "0 0 0 var(--shadow-color)",
              "0 0 1px var(--shadow-color)",
              "0 0 0 var(--shadow-color)",
            ],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "loop",
            delay: i * 0.05,
            ease: "easeInOut",
            repeatDelay: 2,
          }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </div>
  );
};

// Inline SVG for ix-logo (from public/ix-logo.svg)
const IxLogoSVG = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.width || 80}
    height={props.height || 80}
    viewBox="0 0 135 135"
    fill="none"
    {...props}
  >
    <defs>
      <style>{`.cls-1{fill:#1d4e89;}`}</style>
    </defs>
    <title>IxWiki_4</title>
    <path className="cls-1" d="M44.47,78.31a1.62,1.62,0,0,0,1.79-1,.47.47,0,0,1,.51-.29,2.66,2.66,0,0,1,.82.18c.49.29.64.23,1.07-.14s.51-.57.93-.66c.09,0,.2-.27.19-.41a1.2,1.2,0,0,1,.37-1,1.24,1.24,0,0,0,.38-1.18c-.12-.66-.31-1.3-.48-2,0,0,0-.05,0-.09a7,7,0,0,0-.84-2.13.8.8,0,0,1,0-.35,1.41,1.41,0,0,1,.29,0A1.84,1.84,0,0,0,51,69.23c.19-.13.28,0,.35.18a6.87,6.87,0,0,0,.39.92c.24.4.37.39.82.25a10.87,10.87,0,0,0,1.89-1c.15-.09.33-.15.48-.24a2.35,2.35,0,0,0,.47-.36.49.49,0,0,0-.17-.77,1.24,1.24,0,0,0-.91-.08,8.13,8.13,0,0,1-1.56.11c-.29,0-.73-.62-.79-1s-.07-.56-.13-.84a1.06,1.06,0,0,0-1.07-1c-.64,0-.84-.19-.84-.66a.92.92,0,0,1,.22-.56,2.07,2.07,0,0,1,.57-.44A.47.47,0,0,0,51,63.2a2.14,2.14,0,0,1-.15-.55,1.75,1.75,0,0,1,0-.76c.36-.91-.36-2.67-1.52-2.78a.4.4,0,0,1-.39-.42.71.71,0,0,1,.25-.45c.42-.33.87-.61,1.31-.92s1.12-.74,1.65-1.14a6.87,6.87,0,0,0,1.05-.89c.35-.38.23-.64-.27-.73a.75.75,0,0,1-.4-.15A2,2,0,0,0,51,54c-.46,0-.48,0-.58-.5-.14-.66-.31-1.31-.5-2-.12-.41-.32-.45-.63-.16l-.42.43c-.33.35-.69.27-.87-.18s-.31-.64-.45-1a2.2,2.2,0,0,0-1.11-1,2.4,2.4,0,0,1-.85-.76.59.59,0,0,1,0-.8.62.62,0,0,0-.33-1,3.24,3.24,0,0,0-2.13.1.71.71,0,0,1-.84-.14c-.09-.08-.16-.17-.25-.24a.88.88,0,0,1-.32-1.28.86.86,0,0,0,.06-.46,2.39,2.39,0,0,1,.28-1.43,2.08,2.08,0,0,0,.16-.48.55.55,0,0,1,.6-.48.55.55,0,0,0,.39-.21,2.7,2.7,0,0,1,2-1.21,2.56,2.56,0,0,0,2.14-1.78c.08-.24.2-.32.44-.17a2.61,2.61,0,0,1,1,1.21,4.48,4.48,0,0,1,.4,2,1.05,1.05,0,0,0,.48.91.5.5,0,0,0,.81-.12,2.76,2.76,0,0,0,.33-.61,1.19,1.19,0,0,0-.22-1.39.86.86,0,0,1,.08-1.47,4.07,4.07,0,0,1,3.38-.68l.74.15c.65.12,1.12-.28,1.64-.54a3.24,3.24,0,0,1,.33-.13,1.35,1.35,0,0,1,.06.34,2,2,0,0,0,.8,1.51c.56.55,1.14,1.08,1.7,1.64a.93.93,0,0,1-.19,1.39,4.18,4.18,0,0,0-1.56,1.77,1.66,1.66,0,0,0,0,.83c0,.22.27.27.43.08a4.45,4.45,0,0,0,.48-.66c.14-.24.29-.27.51-.1a8.37,8.37,0,0,0,1.48,1,9,9,0,0,0,2.21.61,7.73,7.73,0,0,0,2.2-.05,14.24,14.24,0,0,0,2.29-.66c.2-.06.34-.07.48.08s.3.31.17.56-.13.26-.2.39a1.26,1.26,0,0,0,.23,1.64,3,3,0,0,0,.43.37c.19.15.36.09.44-.14,0,0,0-.06,0-.09.15-.82.28-.91,1.1-.93A2.79,2.79,0,0,0,70.91,48a1,1,0,0,1,1.51,1,4.22,4.22,0,0,0,.32,1.62c.21.53.47,1.07,1.11,1.13a3.22,3.22,0,0,0,1.22-.2c.14,0,.27-.34.28-.54a1.32,1.32,0,0,1,.51-1.12,3.74,3.74,0,0,1,.52-.28l.43-.19c.24-.1.49-.2.72-.31a8,8,0,0,0,.92-.47c.33-.22.29-.43,0-.65a1.29,1.29,0,0,1-.46-.47c-.13-.28.06-.49.37-.48.48,0,1,0,1.42,0a1.64,1.64,0,0,0,.55-.19,7.81,7.81,0,0,1,.75-.3c.85-.23,1.71-.43,2.56-.66a.66.66,0,0,1,.68.12.89.89,0,0,1,.2.94.57.57,0,0,1-.53.43,1.92,1.92,0,0,0-.57.15.61.61,0,0,0-.11,1.07,3.4,3.4,0,0,0,1.86.67c.64.07,1.27.19,1.89.32.36.07.41.25.2.56s-.44.77-.71,1.11a5.24,5.24,0,0,1-.9.86,9.77,9.77,0,0,1-.88.53.53.53,0,0,0-.23.29,6.28,6.28,0,0,0,0,1,.38.38,0,0,0,.23.26.4.4,0,0,0,.29-.18,5.81,5.81,0,0,1,1.32-1.39,5,5,0,0,0,.88-1,.48.48,0,0,1,.62-.22,14,14,0,0,1,1.36.64c.41.22.42.43.1.77-.15.16-.31.33-.46.52a.9.9,0,0,0,.58,1.52,9.93,9.93,0,0,1,1.44.42,2.4,2.4,0,0,1,.58.44l1.77,1.55c.38.35.38.56.11,1s-.4.72-.58,1.08a.47.47,0,0,0,.24.66.51.51,0,0,0,.7-.28c0-.12.07-.25.11-.37.12-.38.22-.76.35-1.14a.48.48,0,0,1,.69-.34.58.58,0,0,1,.32.75,1.73,1.73,0,0,1-.2.32.86.86,0,0,0,0,1c.35.61.65,1.25,1,1.85a5.67,5.67,0,0,0,.88,1.18,5.81,5.81,0,0,0,1.12.76c.46.27.47.38.14.78a1.85,1.85,0,0,0-.35.75,2.75,2.75,0,0,0,0,.81,1.08,1.08,0,0,1-.91,1.3,17.47,17.47,0,0,1-1.91.11c-.1,0-.21-.05-.28,0a1.05,1.05,0,0,0-.29.23c.09.08.17.24.27.25.34,0,.69,0,1,0A.67.67,0,0,1,96,68a3,3,0,0,1,.56.5,3.91,3.91,0,0,1,.58.93c.23.59,0,1-.64,1.44-.83.6-1.64,1.23-2.44,1.88a3,3,0,0,1-2.5.67,1.62,1.62,0,0,1-.4-.19c-.25-.13-.5-.26-.73-.41-.54-.36-.93-.06-1.33.25a4.35,4.35,0,0,1-.41.34,1.16,1.16,0,0,1-1.25.1h0c-.31-.07-.63-.17-.88.13a.91.91,0,0,0,.12,1,1.14,1.14,0,0,0,.15.17.51.51,0,0,1,.15.65.72.72,0,0,1-.77.21,2.2,2.2,0,0,1-.65-.51,1.5,1.5,0,0,0-1.8-.6c-.34.11-.68.22-1,.31a1.08,1.08,0,0,1-1-.25l-.1-.08a1.31,1.31,0,0,0-1.77-.26c-.62.32-1.23.65-1.82,1a.9.9,0,0,1-1.27-.19A3.15,3.15,0,0,1,76,72.62a11.6,11.6,0,0,0-.32-2.17,4.42,4.42,0,0,0-.31-.86,1.35,1.35,0,0,0-.3-.28l-.27.31a0,0,0,0,0,0,0,5.11,5.11,0,0,1-.62,1.91.84.84,0,0,0,.19,1,3.46,3.46,0,0,1,.8,2,1.36,1.36,0,0,0,.51,1.12.58.58,0,0,1,0,.86c-.33.38-.51.9-1,1.16a3.69,3.69,0,0,1-1.86.77,1.68,1.68,0,0,0-1.65,1.24,3.45,3.45,0,0,1-.59.84.6.6,0,0,1-.78-.08,4.54,4.54,0,0,1-.53-.63,2.65,2.65,0,0,0-1.58-1.07,4.9,4.9,0,0,0-1.78-.19,2.28,2.28,0,0,1-1.87-.79,3,3,0,0,1-.9-1.42.5.5,0,0,0-.87-.23c-.61.49-.75.48-1.35-.06a6.11,6.11,0,0,0-.93-.75c-.31-.2-.57,0-.56.33a.79.79,0,0,0,.18.55,11.55,11.55,0,0,0,1,.83,5.8,5.8,0,0,1,.58.52c.46.52.9,1,1.34,1.58.23.26.46.52.67.8s.28.51,0,.91-.39.64-.58,1a.53.53,0,0,0,0,.18.84.84,0,0,1-1.23.74c-.24-.08-.49-.13-.73-.21a.83.83,0,0,0-.75.08.8.8,0,0,1-.92,0,2.52,2.52,0,0,0-1.64-.33c-.29,0-.59-.08-.89-.09a.9.9,0,0,0-.52.09c-.06,0,0,.31,0,.45.32.67.34.67-.28,1a9.42,9.42,0,0,1-.88.49c-.07,0-.18,0-.27,0s-.06,0-.08,0c-.91-.9-2-.7-3.08-.5a1,1,0,0,1-1.17-.45c-.1-.21-.18-.42-.26-.64-.19-.54-.38-.62-.9-.38a4.17,4.17,0,0,1-.58.24,1,1,0,0,1-1-.17,5.81,5.81,0,0,0-1-.51c-.23-.1-.48-.17-.71-.27a.47.47,0,0,1-.12-.83c.39-.33.38-.45,0-.85S44.89,78.87,44.47,78.31Z"/>
    <path className="cls-1" d="M78.19,104.93a9.23,9.23,0,0,1-.86-.65c-.33-.31-.59-.69-.91-1-.81-.77-1.61-1.54-2.45-2.27s-1.63-1.36-2.47-2a25.73,25.73,0,0,0-2.08-1.52,3.27,3.27,0,0,0-2.55-.54,5,5,0,0,0-1.45.66,21.32,21.32,0,0,0-1.8,1.32c-.7.55-1.39,1.12-2.07,1.7s-1.38,1.16-2,1.78-1.1,1.13-1.65,1.69l-.39.36c-.18.15-.35.31-.55.45a.3.3,0,0,1-.29,0,5.05,5.05,0,0,1-.6-.53,8.93,8.93,0,0,1-.66-.72.42.42,0,0,1,.07-.64c.76-.67,1.52-1.36,2.29-2,.55-.46,1.1-.9,1.67-1.33.36-.27.76-.49,1.14-.74s.68-.45,1-.66c.52-.31,1.06-.61,1.59-.93s1-.59,1.46-.91a.44.44,0,0,0,.19-.36.42.42,0,0,0-.32-.24A7.65,7.65,0,0,0,62.9,96a7.28,7.28,0,0,0-2.23.93c-.6.4-1.18.83-1.78,1.23S57.64,99,57,99.41c-.39.26-.77.54-1.18.77a10.58,10.58,0,0,1-1.34.69c-.77.31-1.55.61-2.35.85a8,8,0,0,1-1.61.28,13.29,13.29,0,0,1-2.51.13,9.8,9.8,0,0,1-3.12-.55c-.6-.27-1.24-.42-1.85-.68a7.42,7.42,0,0,1-1.24-.67c-.62-.4-1.21-.85-1.82-1.28-.06,0-.14-.08-.17-.14a.51.51,0,0,1-.07-.33c0-.07.21-.13.29-.11.31.09.61.22.92.33.15.06.3.15.46.2a13.23,13.23,0,0,0,5.11.57,14.1,14.1,0,0,0,1.7-.31c.27-.06.54-.12.8-.2l.76-.29.62-.23c.06,0,.13,0,.18,0l1.65-.77.11-.06,1.75-.68,1.77-.73c.23-.1.47-.17.71-.26l.7-.27a2.55,2.55,0,0,1,.35-.14c.64-.16,1.28-.33,1.93-.46A8.35,8.35,0,0,1,61,94.86a24.94,24.94,0,0,1,4.57.11,12.62,12.62,0,0,1,1.31.34,3.67,3.67,0,0,0,1.68-.07,15,15,0,0,1,2.17-.38c1.49,0,3,0,4.48.11a3.76,3.76,0,0,1,.84.23c.09,0,.16.08.24.08A11.19,11.19,0,0,1,78.8,96c.62.19,1.2.48,1.8.73l.47.18,1.73.73c.62.27,1.21.59,1.84.81.88.31,1.77.59,2.67.83a6.37,6.37,0,0,0,1.57.19,17.44,17.44,0,0,0,2.89-.14,7.8,7.8,0,0,0,2.47-.73,2,2,0,0,1,.78-.14.29.29,0,0,1,.2.16.31.31,0,0,1-.13.23c-.67.47-1.33,1-2,1.38a11.42,11.42,0,0,1-1.49.73,14.6,14.6,0,0,1-1.79.73,7.89,7.89,0,0,1-1.61.3,12.31,12.31,0,0,1-2.57.13,9,9,0,0,1-3-.55,6,6,0,0,0-.64-.17l-.76-.29a.35.35,0,0,1-.13-.08c-.53-.23-1.06-.44-1.57-.7a13.91,13.91,0,0,1-1.23-.75c-.3-.19-.59-.4-.88-.6l-2.63-1.78a6.21,6.21,0,0,0-1.2-.73,7.53,7.53,0,0,0-2.8-.68.37.37,0,0,0-.15,0l-.47.27a1.42,1.42,0,0,0,.31.4c.56.35,1.14.66,1.71,1l1.11.66c.46.29.94.58,1.39.9.76.55,1.51,1.12,2.26,1.7.57.43,1.13.87,1.68,1.33a11.72,11.72,0,0,1,1.12,1.11.49.49,0,0,1,0,.47,2.53,2.53,0,0,1-1,.91A2.39,2.39,0,0,0,78.19,104.93Z"/>
    <path className="cls-1" d="M43.59,92.34l-2.08-.42c-.28-.06-.56-.1-.84-.15-.71-.13-1.42-.26-2.13-.41-1-.21-2-.44-3-.67a1.09,1.09,0,0,1-.24-.07c-.8-.33-1.62-.63-2.41-1a9.89,9.89,0,0,1-1.19-.75c-.39-.24-.78-.49-1.15-.75s-.5-.36-.73-.55a14.52,14.52,0,0,1-2.4-2.49c-.41-.58-.86-1.13-1.26-1.72-.29-.42-.51-.89-.76-1.34s-.53-1-.78-1.43a1.41,1.41,0,0,1-.16-.49c0-.09.08-.2.12-.3a1,1,0,0,1,.31.16c.14.13.25.29.38.43.71.7,1.4,1.42,2.14,2.09a7.93,7.93,0,0,0,1.18.76c.35.22.7.46,1.06.66l1.56.79,1.74.85c.42.21.83.4,1.24.62.57.3,1.13.62,1.69,1,.31.18.62.38.93.57a9.69,9.69,0,0,1,1.92,1.45,3.31,3.31,0,0,0,.58.47c.08,0,.27,0,.29,0a.36.36,0,0,0,0-.33,4.66,4.66,0,0,0-.39-.49c-.43-.51-.87-1-1.28-1.52a5,5,0,0,1-.62-1c-.26-.58-.47-1.18-.71-1.78,0-.08,0-.18-.08-.27A7.08,7.08,0,0,1,36,81.92c-.25-1.42-.53-2.85-.81-4.27-.11-.56-.25-1.12-.37-1.69-.05-.25.08-.39.32-.29a1,1,0,0,1,.41.32c.63.9,1.27,1.8,1.86,2.72a12.68,12.68,0,0,1,.71,1.43l.8,1.68,0,.08c.22.65.44,1.31.67,2l.25.7c.08.24.14.49.23.72s.24.54.35.81c.23.59.43,1.2.71,1.77a21.55,21.55,0,0,0,1.26,2.25c.41.61.92,1.16,1.38,1.75.06.08.13.25.1.3S43.72,92.28,43.59,92.34Z"/>
    <path className="cls-1" d="M91.69,92.17c-.33,0-.43-.15-.3-.4a3.09,3.09,0,0,1,.26-.37c.47-.66.95-1.32,1.4-2a7,7,0,0,0,.54-1.06c.24-.52.45-1,.66-1.56.29-.71.57-1.42.85-2.13l.09-.2c.2-.65.38-1.31.62-2s.5-1.21.76-1.81c.05-.11.1-.21.14-.32a10,10,0,0,1,1.45-2.53c.36-.5.73-1,1.11-1.48a1.21,1.21,0,0,1,.35-.21c.06.13.17.27.15.4-.11.76-.26,1.51-.37,2.27-.09.6-.12,1.21-.21,1.81-.12.76-.26,1.51-.44,2.26a14,14,0,0,1-.64,2.3,7.7,7.7,0,0,1-1.35,2.42l-1.05,1.14a.3.3,0,0,0,0,.47.36.36,0,0,0,.54,0c.37-.32.74-.63,1.13-.92s.74-.56,1.11-.82.65-.42,1-.63a8.89,8.89,0,0,1,.79-.45c.51-.26,1-.48,1.56-.73s1-.52,1.57-.78.87-.41,1.28-.65c.82-.46,1.62-1,2.44-1.41a8.44,8.44,0,0,0,2-1.72c.33-.37.6-.8.91-1.19a1.46,1.46,0,0,1,.24-.17c0,.09.13.17.13.25a1,1,0,0,1-.09.43c-.29.68-.57,1.38-.9,2a11.29,11.29,0,0,1-.85,1.31,12.3,12.3,0,0,1-1.12,1.44c-.84.87-1.71,1.71-2.6,2.52a16.6,16.6,0,0,1-1.7,1.3,9.46,9.46,0,0,1-1.3.69c-.61.28-1.25.53-1.87.8l-.06,0-2.51.68a14.29,14.29,0,0,1-1.69.4c-.93.15-1.88.23-2.82.35C92.48,92,92.06,92.11,91.69,92.17Z"/>
    <path className="cls-1" d="M21,68.71c0-.31-.07-.61-.08-.91,0-.1.09-.21.14-.31a1.19,1.19,0,0,1,.22.23c.26.43.48.88.74,1.31.42.66.87,1.31,1.32,2a5.43,5.43,0,0,0,.66.84c1.18,1.23,2.36,2.46,3.57,3.66a18.5,18.5,0,0,1,1.88,2.28c.2.28.39.55.6.81a.42.42,0,0,0,.33.11.36.36,0,0,0,.18-.28c-.07-.53-.17-1.06-.26-1.59a13.93,13.93,0,0,1-.26-1.55,10.77,10.77,0,0,1,.38-3.91c0-.13.06-.26.09-.4.14-.87.29-1.74.42-2.61.08-.54.12-1.09.19-1.63a3.08,3.08,0,0,1,.19-.47c.13.11.32.2.39.34a3.79,3.79,0,0,1,.25.74c.11.43.23.85.33,1.28s.15.68.19,1c.17,1.27.32,2.53.47,3.79,0,.39,0,.78.08,1.17.15,1.37.31,2.75.46,4.13,0,.33,0,.67.07,1a15.17,15.17,0,0,0,.67,2.91,9.88,9.88,0,0,0,.42,1.19c.05.13.17.24.23.37a.7.7,0,0,1,0,.29.83.83,0,0,1-.28,0l-1.54-.91-1.29-.82c-.29-.18-.58-.34-.86-.52l-2.34-1.52a21.16,21.16,0,0,1-3.95-3.43,17.56,17.56,0,0,1-1.59-2,8,8,0,0,1-.69-1.33,17.74,17.74,0,0,1-.73-1.74,11.74,11.74,0,0,1-.35-1.56c-.13-.62-.23-1.24-.34-1.86Z"/>
    <path className="cls-1" d="M105,74.35c0,.75-.09,1.49-.15,2.24a2.86,2.86,0,0,1-.16.64c-.11.38-.22.77-.35,1.14a5.28,5.28,0,0,1-.27.53c0,.11-.15.22-.15.33s.1.23.16.34c.11,0,.26-.08.32-.17a32.29,32.29,0,0,1,3.17-4c1.12-1.13,2.22-2.27,3.3-3.44.48-.53.89-1.13,1.32-1.71a7.74,7.74,0,0,0,.74-1.06c.26-.47.44-1,.67-1.48.09-.19,0-.57.33-.51s.22.39.2.61a12.75,12.75,0,0,1-.48,3.36c-.25.72-.42,1.46-.69,2.16a8.94,8.94,0,0,1-.79,1.46c-.53.8-1.08,1.6-1.67,2.35a8.74,8.74,0,0,1-1.27,1.31c-1,.85-2,1.67-3,2.49-.23.18-.49.32-.74.48L103,83c-.64.4-1.29.77-1.93,1.17-.14.09-.25.22-.4.3a.43.43,0,0,1-.34,0,.39.39,0,0,1-.06-.33c.09-.29.23-.58.34-.87a.77.77,0,0,0,.1-.23,19.06,19.06,0,0,0,.64-3.18,3.18,3.18,0,0,1,.06-.43,20.52,20.52,0,0,0,.35-3c0-.72.11-1.44.18-2.16l.48-4.32a3.89,3.89,0,0,1,.09-.47c.11-.53.21-1.07.35-1.59s.33-1.15.52-1.72c0-.08.14-.14.21-.2a1,1,0,0,1,.17.24,1.64,1.64,0,0,1,0,.44,6,6,0,0,0,.32,2l0,.09C104.43,70.59,105.1,72.41,105,74.35Z"/>
    <path className="cls-1" d="M45.54,97a5.15,5.15,0,0,1-.85.18c-.66,0-1.31,0-2,0A12.52,12.52,0,0,1,41.35,97a12.72,12.72,0,0,1-1.63-.33c-.76-.24-1.5-.53-2.24-.83a8.91,8.91,0,0,1-1.13-.62,19.19,19.19,0,0,1-3.5-2.86,8.27,8.27,0,0,1-.56-.64.78.78,0,0,1,0-.35c.11,0,.24-.07.34,0s.44.23.67.34.36.16.54.25l1.69.8a1.57,1.57,0,0,0,.23.09,21.14,21.14,0,0,0,4.25.74c.82,0,1.64.19,2.46.28.15,0,.31,0,.47,0,1.22.07,2.44.11,3.65.2.39,0,.77.19,1.17.25a6.06,6.06,0,0,0,1.12.1c.15,0,.3-.16.45-.25a2,2,0,0,0-.43-.29,1.77,1.77,0,0,0-.46-.07.72.72,0,0,1-.22,0,9.59,9.59,0,0,1-1.27-.78,18.84,18.84,0,0,1-1.82-1.64,7.2,7.2,0,0,1-1.35-2c-.19-.43-.46-.82-.69-1.23l-.23-.44-.9-1.72c-.15-.29-.34-.56-.49-.84,0-.08-.05-.25,0-.29a.34.34,0,0,1,.31,0,8.1,8.1,0,0,1,.91.62,43.6,43.6,0,0,1,3.73,3.34,26.49,26.49,0,0,0,1.92,1.9c.73.65,1.5,1.24,2.27,1.83.36.28.76.52,1.14.78.08,0,.17.08.25.12l.85.4a4.32,4.32,0,0,0,.51.16,2.7,2.7,0,0,1,.57.18,3.06,3.06,0,0,0,1.33.35,1.13,1.13,0,0,1,.31.06c.07,0,.12.11.19.17s-.1.15-.17.17c-.57.18-1.14.35-1.72.51l-.94.25-1.06.28-.92.23a22.94,22.94,0,0,1-4.26.84,10.13,10.13,0,0,0-1.08.18Z"/>
    <path className="cls-1" d="M93.42,85a2.78,2.78,0,0,1-.53,1.3c-.27.48-.54,1-.8,1.45s-.48.9-.74,1.35a13,13,0,0,1-.76,1.3,20.53,20.53,0,0,1-1.5,1.85,3.44,3.44,0,0,1-1.1.83c-.62.28-1.16.78-1.91.72a.66.66,0,0,0-.34.08,1.64,1.64,0,0,0-.26.31c.11.08.22.21.33.22a3.75,3.75,0,0,0,.82,0c.32,0,.63-.1.94-.14.73-.12,1.47-.26,2.21-.33s1.47,0,2.2-.09c.92-.07,1.84-.19,2.76-.28.48,0,1-.09,1.44-.16.69-.1,1.38-.24,2.08-.35a10.5,10.5,0,0,0,2.27-.71,15.76,15.76,0,0,0,1.58-.82s.08-.09.13-.1.38-.09.45,0,0,.28-.16.4c-.58.58-1.12,1.2-1.72,1.75a20.13,20.13,0,0,1-1.73,1.31,10.24,10.24,0,0,1-1.26.79,11.64,11.64,0,0,1-1.49.66,14.89,14.89,0,0,1-3.72.8,11.2,11.2,0,0,1-1.41.13c-.82,0-1.63-.13-2.44-.23a18.71,18.71,0,0,1-3.13-.57c-1-.31-2.11-.48-3.15-.76-.82-.22-1.63-.5-2.43-.76a.31.31,0,0,1-.21-.13c0-.06,0-.16,0-.24s.08,0,.12,0a6.83,6.83,0,0,0,2.08-.66,10.45,10.45,0,0,0,1.28-.68,9.94,9.94,0,0,0,1.11-.71c.76-.59,1.54-1.17,2.24-1.83,1.09-1,2.11-2.12,3.18-3.15a17.39,17.39,0,0,1,1.42-1.15c.42-.33.84-.66,1.29-1A6.22,6.22,0,0,1,93.42,85Z"/>
    <path className="cls-1" d="M114,59a11.39,11.39,0,0,1,0,1.17c-.07.65-.17,1.29-.27,1.93,0,.28-.11.56-.17.84a9.61,9.61,0,0,1-1,2.74c-.19.36-.35.73-.53,1.1a15.66,15.66,0,0,1-1.93,2.89c-.79,1-1.57,2-2.34,3-.32.41-.62.83-.93,1.23-.05.06-.17.14-.23.12s-.14-.14-.18-.23a.27.27,0,0,1,0-.18,9.39,9.39,0,0,0,0-3.26,16,16,0,0,0-.42-1.94c-.21-.82-.43-1.64-.67-2.45-.1-.34-.28-.66-.37-1-.27-1-.54-2.1-.77-3.15s-.48-2.37-.67-3.56c-.11-.71-.13-1.43-.2-2.14v0l.21-.63a3.82,3.82,0,0,1,.34.48c.41.7.81,1.42,1.21,2.13l.09.16c.34.62.7,1.22,1,1.84.45.89.85,1.8,1.27,2.7a13.47,13.47,0,0,1,.87,3.28c0,.26,0,.53.07.79s.16.24.25.36c.09-.11.24-.21.28-.33.19-.74.33-1.51.55-2.24s.54-1.45.84-2.17.59-1.38.89-2.08a28.1,28.1,0,0,0,1.2-2.9,7.65,7.65,0,0,0,.6-2.88.92.92,0,0,1,0-.37,1.37,1.37,0,0,1,.19-.23c.07.08.18.14.2.23a13.67,13.67,0,0,1,.27,1.42c.13,1.13.24,2.25.35,3.38Z"/>
    <path className="cls-1" d="M31.56,56.44a18,18,0,0,1-.51,4c-.21,1-.37,2-.61,2.92s-.54,1.8-.81,2.69c0,.07-.06.13-.08.2a26.51,26.51,0,0,1-.75,2.64,10.05,10.05,0,0,0-.48,3.44c0,.23.07.46.07.68a1.42,1.42,0,0,1-.15.42,1.13,1.13,0,0,1-.32-.19c-.78-.83-1.56-1.65-2.3-2.51-.56-.66-1.06-1.39-1.57-2.09a5.64,5.64,0,0,1-.4-.67,23.52,23.52,0,0,1-1.16-2.15,18.35,18.35,0,0,1-1-2.78,18.92,18.92,0,0,1-.61-4.17,16.14,16.14,0,0,1,.33-3.47c.06-.29.05-.59.11-.88a1.39,1.39,0,0,1,.27-.38c.12.11.25.21.37.33a.13.13,0,0,1,0,.09l.33,2.17a1.14,1.14,0,0,0,.06.25c.36.93.7,1.86,1.09,2.78s.84,1.75,1.21,2.65c.29.7.49,1.43.73,2.14a5.65,5.65,0,0,1,.48,1.94,5.83,5.83,0,0,0,.06.72c0,.2.1.39.35.37s.25-.22.26-.4,0-.43,0-.64a10.32,10.32,0,0,1,.49-2.75,13,13,0,0,1,.77-1.92c.17-.38.35-.76.54-1.13s.49-1,.77-1.48.53-.85.78-1.28.36-.61.53-.93l.65-1.32a.4.4,0,0,1,.11-.19,1.31,1.31,0,0,1,.27-.12.7.7,0,0,1,.1.26C31.59,55.93,31.57,56.18,31.56,56.44Z"/>
    <path className="cls-1" d="M25.85,42.16c0,1-.12,2.09-.08,3.14s.21,1.94.31,2.9.24,1.92.29,2.88,0,1.66,0,2.5a2.43,2.43,0,0,0,.09.65.34.34,0,0,0,.25.18c.07,0,.2-.1.22-.18a7.45,7.45,0,0,1,1.94-2.94c.57-.66,1.16-1.3,1.79-1.9s1.4-1.26,2.1-1.9c.28-.25.52-.54.8-.8a1.74,1.74,0,0,1,.33-.18c0,.13.16.26.15.38a2.42,2.42,0,0,1-.14.71,19.59,19.59,0,0,1-.71,2c-.4.88-.84,1.75-1.32,2.6-.35.6-.8,1.15-1.2,1.72l-1.29,1.82c-.17.24-.34.48-.5.73-.45.66-.95,1.3-1.34,2S26.8,60,26.42,60.78a1.45,1.45,0,0,1-.24.26c-.07-.1-.2-.19-.22-.3a19,19,0,0,0-.84-2.65c-.3-.81-.56-1.63-.86-2.43a26.33,26.33,0,0,1-1.09-4.39,13.33,13.33,0,0,1,.32-4.72,10.66,10.66,0,0,1,.78-2.15c.21-.55.47-1.08.73-1.6.16-.33.34-.65.53-1a.29.29,0,0,1,.2-.12.37.37,0,0,1,.18.19.67.67,0,0,1,0,.25Z"/>
    <path className="cls-1" d="M111.85,48.76a8,8,0,0,1,.09,1.19c-.07.83-.2,1.66-.31,2.49,0,.3-.1.58-.15.87a10.66,10.66,0,0,1-.89,2.75c-.07.16-.11.33-.17.51s0,.2-.06.3c-.21.54-.43,1.07-.62,1.62-.14.39-.24.8-.35,1.2s-.2.8-.34,1.18a.46.46,0,0,1-.34.25c-.09,0-.25-.17-.27-.29a7.85,7.85,0,0,0-1.08-2.46c-.48-.82-1-1.61-1.52-2.39-.38-.56-.82-1.07-1.21-1.62s-.86-1.28-1.29-1.93c-.26-.4-.54-.79-.77-1.21s-.5-1.08-.75-1.62l-.15-.38c-.1-.27-.21-.55-.3-.82s-.26-.84-.39-1.27c0-.08-.09-.16-.08-.23a3.74,3.74,0,0,1,.12-.45,3,3,0,0,1,.35.21l.89.8c1.13,1.11,2.31,2.19,3.38,3.35a12.75,12.75,0,0,1,2.09,3,.64.64,0,0,1,.1.26,2.14,2.14,0,0,0,.7,1.17s.17.08.19.06a.44.44,0,0,0,.11-.24c0-.54,0-1.09-.12-1.63a10.21,10.21,0,0,1,0-3.17c.15-.82.16-1.67.25-2.5s.24-1.65.28-2.48,0-1.59-.08-2.38c0-.32-.09-.64-.12-1,0-.06.1-.13.15-.2a.69.69,0,0,1,.18.16c.26.4.53.8.76,1.22A6,6,0,0,1,111,45c0,.18.16.35.2.53.17.68.33,1.36.47,2,.09.38.15.78.22,1.17Z"/>
    <path className="cls-1" d="M107.5,42c0,1.12.07,2.25.11,3.37a.88.88,0,0,1,0,.28,6.74,6.74,0,0,0-.16,2.19c0,.54,0,1.08,0,1.61a.85.85,0,0,1,0,.32,3.57,3.57,0,0,1-.25.47c-.11-.12-.22-.23-.32-.35-.39-.44-.75-.91-1.16-1.33s-1-1-1.5-1.39-1-.76-1.51-1.17a38.86,38.86,0,0,1-3.15-2.86,9.25,9.25,0,0,1-1.87-2.74c-.23-.55-.47-1.09-.69-1.65a1.29,1.29,0,0,1-.08-.4c0-.25.12-.33.33-.19a2.92,2.92,0,0,1,.5.43,14.3,14.3,0,0,0,2.11,1.93c.58.39,1.13.84,1.69,1.26A16.7,16.7,0,0,1,103,42.83c.68.62,1.3,1.31,2,2,.09.09.26.19.36.16s.18-.23.17-.34a4.62,4.62,0,0,0-.18-.82c-.07-.25-.2-.47-.25-.72-.22-1.11-.4-2.23-.66-3.33a22.28,22.28,0,0,0-.75-2.36,12,12,0,0,0-.72-1.49c-.24-.41-.55-.78-.82-1.18a1.17,1.17,0,0,1-.09-.32c.12,0,.27,0,.36,0a21.09,21.09,0,0,1,2.06,1.44,10.09,10.09,0,0,1,1.41,1.51,9.22,9.22,0,0,1,.89,1.48,5,5,0,0,1,.31.95c.15.51.29,1,.41,1.54a4.5,4.5,0,0,1,.07.63Z"/>
    <path className="cls-1" d="M27.62,48.43c-.05-1.12-.11-2.24-.15-3.36a18,18,0,0,1,.21-4.21,8.06,8.06,0,0,1,.39-1.46,7.4,7.4,0,0,1,.81-1.52,12.17,12.17,0,0,1,1.37-1.67,12.6,12.6,0,0,1,1.38-1,2.88,2.88,0,0,1,.39-.32,1.53,1.53,0,0,1,.49-.08c0,.16,0,.37-.09.48a5.62,5.62,0,0,0-1,1.91c-.3.94-.58,1.88-.84,2.84-.1.36-.09.75-.16,1.12s-.19.66-.27,1-.13.73-.23,1.08-.24.67-.36,1a1.39,1.39,0,0,0-.1.26c0,.22-.08.48.19.58s.33-.14.46-.29a13.9,13.9,0,0,1,1.23-1.31c.89-.75,1.8-1.47,2.73-2.17a17.83,17.83,0,0,0,2.78-2.35c.31-.35.56-.75.85-1.12.06-.08.16-.11.24-.17.06.09.18.19.17.26-.06.36-.13.72-.22,1.08s-.21.61-.32.92a.88.88,0,0,1,0,.15c-.47.68-.82,1.42-1.32,2.09a13.94,13.94,0,0,1-1.67,1.92c-.53.48-1.09.92-1.64,1.37l-1.33,1.11c-.5.41-1,.8-1.5,1.24a7.83,7.83,0,0,0-1.69,1.85.46.46,0,0,1-.37.18.44.44,0,0,1-.27-.29c-.08-.36-.1-.73-.15-1.09Z"/>
    <path className="cls-1" d="M32.06,40.54c.1-.3.19-.56.26-.82s.16-.66.27-1c.28-.78.57-1.55.88-2.32A11,11,0,0,1,34,35.35a8.13,8.13,0,0,1,2.34-2.61,24.38,24.38,0,0,1,2.08-1.4,11.45,11.45,0,0,1,1.48-.65c.14-.06.27-.14.4-.19.37-.15.73-.3,1.11-.42.18-.06.29,0,.25.24a.88.88,0,0,1-.12.32c-.36.52-.72,1-1.09,1.54s-.89,1.26-1.36,1.87c-.61.79-1.23,1.58-1.88,2.33s-1.24,1.4-1.93,2-1.57,1.32-2.36,2a3.92,3.92,0,0,1-.37.34.41.41,0,0,1-.33.08C32.16,40.78,32.12,40.63,32.06,40.54Z"/>
    <path className="cls-1" d="M93.46,30.05c.46.17.94.33,1.41.49l.32.13c.61.3,1.21.62,1.82.9a5.79,5.79,0,0,1,1.64,1.2c.68.69,1.33,1.41,1.95,2.15a6.66,6.66,0,0,1,.68,1.16c.28.55.53,1.1.79,1.66.09.21.14.44.21.66.18.6.35,1.21.53,1.81,0,.09.07.17,0,.25s-.07.29-.16.34a.42.42,0,0,1-.37-.07,35.09,35.09,0,0,1-3.87-3.54,18.76,18.76,0,0,1-1.22-1.6c-.56-.78-1.09-1.57-1.67-2.33S94.35,31.73,93.74,31c-.14-.16-.32-.27-.46-.43a.51.51,0,0,1-.08-.32S93.34,30.13,93.46,30.05Z"/>
  </svg>
);

// GlobalLoader: Animated ix-logo SVG
export const GlobalLoader = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] w-full py-8">
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
        className="inline-block"
      >
        <IxLogoSVG width={80} height={80} />
      </motion.div>
      <span className="mt-4 text-lg font-semibold text-blue-900 opacity-80">Loading...</span>
    </div>
  );
};
