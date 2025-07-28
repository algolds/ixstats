/**
 * Focused Card Layout Component
 * Provides centered, focused view for expanded cards with proper grid management
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '~/lib/utils';

interface FocusedCardLayoutProps {
  isExpanded: boolean;
  cardId: string;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  maxWidth?: string;
}

export const FocusedCardLayout: React.FC<FocusedCardLayoutProps> = ({
  isExpanded,
  cardId,
  title,
  children,
  onClose,
  className,
  maxWidth = "4xl"
}) => {
  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Focused Card Container */}
          <motion.div
            className={cn(
              "relative w-full max-h-[90vh] overflow-y-auto",
              `max-w-${maxWidth}`,
              "glass-modal glass-refraction border border-white/20 dark:border-white/10",
              "rounded-xl shadow-2xl",
              className
            )}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 30,
              duration: 0.4 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Close Button */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface ExpandableCardProps {
  cardId: string;
  title: string;
  subtitle?: string;
  expandedTitle?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  children: React.ReactNode;
  expandedContent?: React.ReactNode;
  className?: string;
  expandedMaxWidth?: string;
}

export const ExpandableCard: React.FC<ExpandableCardProps> = ({
  cardId,
  title,
  subtitle,
  expandedTitle,
  isExpanded,
  onToggleExpand,
  children,
  expandedContent,
  className,
  expandedMaxWidth = "6xl"
}) => {
  return (
    <>
      {/* Collapsed Card */}
      <motion.div
        className={cn(
          "glass-hierarchy-parent relative overflow-hidden group cursor-pointer",
          "rounded-xl border border-neutral-200 dark:border-white/[0.2] transition-all duration-200",
          className
        )}
        onClick={onToggleExpand}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.995 }}
        transition={{ type: "spring", stiffness: 400, damping: 40 }}
        layout
      >
        {children}
      </motion.div>

      {/* Focused Expanded View */}
      <FocusedCardLayout
        isExpanded={isExpanded}
        cardId={cardId}
        title={expandedTitle || title}
        onClose={onToggleExpand}
        maxWidth={expandedMaxWidth}
      >
        {expandedContent || (
          <div className="text-center py-8 text-muted-foreground">
            <p>No expanded content provided for {title}</p>
          </div>
        )}
      </FocusedCardLayout>
    </>
  );
};

export default FocusedCardLayout;