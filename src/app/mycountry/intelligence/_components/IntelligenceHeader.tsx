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
      className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
    >
      <div>
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 p-2">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Intelligence Center</h1>
            <p className="text-muted-foreground text-sm">
              Strategic intelligence for {countryName}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="animate-pulse border-green-500 text-green-600">
          <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-500" />
          LIVE
        </Badge>
        <Badge variant="secondary">{briefingsCount} Briefings</Badge>
      </div>
    </motion.div>
  );
}
