import { motion } from "framer-motion";
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
      className="flex flex-col items-start justify-between gap-3 sm:gap-4 sm:flex-row sm:items-center"
    >
      <div>
        <div className="mb-2 flex items-center gap-2 sm:gap-3">
          <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 p-1.5 sm:p-2 flex-shrink-0">
            <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Intelligence Center</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Strategic intelligence for {countryName}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="animate-pulse border-green-500 text-green-600 text-xs">
          <div className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-green-500" />
          LIVE
        </Badge>
        <Badge variant="secondary" className="text-xs">{briefingsCount} Briefings</Badge>
      </div>
    </motion.div>
  );
}
