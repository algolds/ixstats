"use client";

import { useEffect } from "react";
import { EnhancedCommandCenter } from "../_components/EnhancedCommandCenter";

export default function DashboardPage() {
  useEffect(() => {
    document.title = "Dashboard - IxStats";
  }, []);

  // Enhanced home page with social activity feed and platform-wide engagement
  // Combines the best of the original CommandCenter with new social features
  return <EnhancedCommandCenter />;
}