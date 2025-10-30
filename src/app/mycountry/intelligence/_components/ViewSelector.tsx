import { Button } from "~/components/ui/button";
import { Activity, FileText, Target, BarChart3 } from "lucide-react";

type ViewType = "overview" | "briefings" | "focus" | "analytics";

interface ViewSelectorProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  briefingsCount: number;
}

export function ViewSelector({ activeView, onViewChange, briefingsCount }: ViewSelectorProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b pb-2">
      <Button
        variant={activeView === "overview" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("overview")}
      >
        <Activity className="mr-2 h-4 w-4" />
        Overview
      </Button>
      <Button
        variant={activeView === "briefings" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("briefings")}
      >
        <FileText className="mr-2 h-4 w-4" />
        Briefings ({briefingsCount})
      </Button>
      <Button
        variant={activeView === "focus" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("focus")}
      >
        <Target className="mr-2 h-4 w-4" />
        Focus Areas
      </Button>
      <Button
        variant={activeView === "analytics" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("analytics")}
      >
        <BarChart3 className="mr-2 h-4 w-4" />
        Analytics
      </Button>
    </div>
  );
}
