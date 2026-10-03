import React from "react";

interface DrivingIconProps {
  className?: string;
}

const FORWARD_LANE = { strokeWidth: "1.6", className: undefined };
const ONCOMING_LANE = { strokeWidth: "1.2", className: "opacity-35" };

/**
 * Apple-style dual-lane road icon. The forward lane carries traffic upward at full weight,
 * the oncoming lane carries it downward faded.
 */
function RoadIcon({
  className,
  forwardLane,
}: DrivingIconProps & { forwardLane: "left" | "right" }) {
  const forward =
    forwardLane === "left"
      ? "M5 11.5v-7m-1.75 2L5 4.5l1.75 2"
      : "M11 11.5v-7m-1.75 2L11 4.5l1.75 2";
  const oncoming =
    forwardLane === "left" ? "M11 4.5v7m-1.75-2L11 11.5l1.75-2" : "M5 4.5v7m-1.75-2L5 11.5l1.75-2";
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <line
        x1="2"
        y1="2"
        x2="2"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="opacity-30"
      />
      <line
        x1="14"
        y1="2"
        x2="14"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="opacity-30"
      />

      <line
        x1="8"
        y1="2.5"
        x2="8"
        y2="13.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        strokeLinecap="round"
        className="opacity-40"
      />

      <path
        d={oncoming}
        stroke="currentColor"
        strokeWidth={ONCOMING_LANE.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={ONCOMING_LANE.className}
      />
      <path
        d={forward}
        stroke="currentColor"
        strokeWidth={FORWARD_LANE.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Right-hand traffic: the forward lane is on the right. */
export function RightDriveIcon({ className }: DrivingIconProps) {
  return <RoadIcon className={className} forwardLane="right" />;
}

/** Left-hand traffic: the forward lane is on the left. */
export function LeftDriveIcon({ className }: DrivingIconProps) {
  return <RoadIcon className={className} forwardLane="left" />;
}
