import React from "react";
import { Button } from "~/components/ui/button";
import { Send } from "iconoir-react";

interface RackPublishBarProps {
  onPublish: () => void;
  isPublishing: boolean;
  isDisabled: boolean;
}

export const RackPublishBar = React.memo(function RackPublishBar({
  onPublish,
  isPublishing,
  isDisabled,
}: RackPublishBarProps) {
  return (
    <div className="pt-2">
      <Button
        variant="default"
        size="lg"
        onClick={onPublish}
        disabled={isPublishing || isDisabled}
        className="h-11 w-full gap-2 text-sm font-bold shadow-lg"
      >
        <Send className="h-4 w-4" />
        {isPublishing ? "Publishing Card to Database..." : "Publish Designed Card to Database"}
      </Button>
    </div>
  );
});
