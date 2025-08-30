import { motion } from "framer-motion";
import { Crown, Sparkles, Eye, ArrowLeft } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

interface EditorHeaderProps {
  countryName: string;
  countryId: string;
}

export function EditorHeader({ countryName, countryId }: EditorHeaderProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500">
          <Crown className="h-8 w-8 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">MyCountry Data Editor: {countryName}</h1>
            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
              <Sparkles className="h-3 w-3 mr-1" />
              EDITOR
            </Badge>
          </div>
          <p className="text-muted-foreground">Real-time economic data management & validation</p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Link href={createUrl(`/countries/${countryId}`)}>
          <Button variant="outline" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Public View
          </Button>
        </Link>
        <Link href={createUrl("/mycountry")}>
          <Button variant="outline" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
