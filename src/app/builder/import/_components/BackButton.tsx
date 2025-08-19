import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  onClick: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick }) => {
  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border backdrop-blur-md transition-all duration-200"
      style={{
        backgroundColor: 'var(--color-bg-surface)/90',
        borderColor: 'var(--color-border-primary)',
        color: 'var(--color-text-primary)'
      }}
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Search
    </motion.button>
  );
};
