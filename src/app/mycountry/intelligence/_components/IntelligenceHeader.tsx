import { motion } from "motion/react";
import { Brain } from "lucide-react";
import { Badge } from "~/components/ui/badge";

interface IntelligenceHeaderProps {
  countryName?: string;
  briefingsCount: number;
}

export function IntelligenceHeader({ countryName, briefingsCount }: IntelligenceHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <div>
        <div className="mb-2 flex items-center gap-2 sm:gap-3">
          <div className="flex-shrink-0 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 p-1.5 sm:p-2">
            <Brain className="h-5 w-5 text-white sm:h-6 sm:w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Intelligence Center</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Strategic intelligence for {countryName}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="animate-pulse border-green-500 text-xs text-green-600">
          <div className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-green-500" />
          LIVE
        </Badge>
        <Badge variant="secondary" className="text-xs">
          {briefingsCount} Briefings
        </Badge>
      </div>
    </motion.div>
  );
}
