"use client";
import { useEffect, useState } from "react";

export function LiveTime({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return <span className={className}>{now.toLocaleTimeString()}</span>;
}
