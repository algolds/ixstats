import React from "react";

interface ThinkPagesIconProps {
  className?: string;
  size?: number;
}

export const ThinkPagesIcon: React.FC<ThinkPagesIconProps> = ({ className = "", size = 16 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="tp-linear-gradient"
          x1="112"
          y1="512"
          x2="912"
          y2="512"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#0cc" />
          <stop offset="1" stopColor="#0aa2b5" />
        </linearGradient>
        <linearGradient
          id="tp-linear-gradient1"
          x1="90.5"
          y1="811.2"
          x2="91.5"
          y2="810.2"
          gradientTransform="translate(-14453 91652.9) scale(168 -112)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#e6f7fb" />
          <stop offset="1" stopColor="#cfeff6" />
        </linearGradient>
      </defs>
      <rect
        fill="url(#tp-linear-gradient)"
        x="112"
        y="112"
        width="800"
        height="800"
        rx="112"
        ry="112"
      />
      <path
        fill="url(#tp-linear-gradient1)"
        fillOpacity="0.9"
        d="M800,912h112v-112s-56,0-112,56l-56,56h56Z"
      />
      <path
        fill="currentColor"
        d="M512.1,400.7c0-24.7,0-49.5,0-74.3h114.2c97.3,3.2,146.1,122.6,74.8,191.4-32.3,31.2-71.6,33.4-114.6,31.4-.7,13.7.9,28.3,0,41.9-6.5,101.3-131,144.1-197.1,66.3-9.4-11.1-24.9-40.4-24.9-54.6v-126.2l-1.6-1.6h-72.2l-1.6-1.6v-71.1l3.7-1.6c73.1.2,146.3-.1,219.4,0,0,24.7,0,49.6,0,74.2-21.5,0-51.5-2.4-71.7,0s-2.7,5.3-2.6,10.1c.6,24.1-1.7,48.8-1.2,73.3.2,11.3-.3,31.4,3.4,41.2,13.9,36.7,68.9,29.8,72.1-10.4,2.8-35.3-.1-77.9,0-114.1,36.4,0,78.7,2.7,114.2,0,45.2-3.4,46.5-70.6-1.1-74.3-35-2.8-77.3.1-113.1,0Z"
      />
    </svg>
  );
};
