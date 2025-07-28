"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { 
  ChevronDown, 
  Crown, 
  Settings, 
  TrendingUp, 
  MapPin, 
  Users, 
  Building2 
} from 'lucide-react';

interface RadialMenuItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  color: string;
}

interface RadialContextMenuProps {
  className?: string;
  items?: RadialMenuItem[];
}

const defaultItems: RadialMenuItem[] = [
  {
    id: 'profile',
    icon: <Crown className="h-4 w-4" />,
    label: 'Country Profile',
    href: '/mycountry',
    color: 'text-yellow-400'
  },
  {
    id: 'policies',
    icon: <Settings className="h-4 w-4" />,
    label: 'Policy Control',
    onClick: () => console.log('Policy Control'),
    color: 'text-blue-400'
  },
  {
    id: 'economics',
    icon: <TrendingUp className="h-4 w-4" />,
    label: 'Economic Data',
    href: '/analytics',
    color: 'text-green-400'
  },
  {
    id: 'geography',
    icon: <MapPin className="h-4 w-4" />,
    label: 'Geographic Stats',
    onClick: () => console.log('Geographic Stats'),
    color: 'text-purple-400'
  },
  {
    id: 'demographics',
    icon: <Users className="h-4 w-4" />,
    label: 'Demographics',
    onClick: () => console.log('Demographics'),
    color: 'text-pink-400'
  },
  {
    id: 'infrastructure',
    icon: <Building2 className="h-4 w-4" />,
    label: 'Infrastructure',
    onClick: () => console.log('Infrastructure'),
    color: 'text-orange-400'
  }
];

export const RadialContextMenu: React.FC<RadialContextMenuProps> = ({ 
  className, 
  items = defaultItems 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleItemClick = (item: RadialMenuItem) => {
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      window.open(item.href, '_blank');
    }
    setIsOpen(false);
  };

  const radius = 80;
  const centerX = 0;
  const centerY = 0;

  const getItemPosition = (index: number, total: number) => {
    // Start from top (-90 degrees) and distribute evenly around the circle
    const angle = (-Math.PI / 2) + (index * (2 * Math.PI)) / total;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  return (
    <div className={cn("relative", className)}>
      {/* Center Button */}
      <motion.button
        className="p-3 rounded-full glass-hierarchy-interactive glass-refraction transition-all duration-200 relative z-10"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        animate={{ 
          rotate: isOpen ? 45 : 0,
          scale: isOpen ? 1.1 : 1
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <ChevronDown className="h-5 w-5 text-foreground" />
      </motion.button>

      {/* Radial Menu Items */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[5]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />
            
            {/* Menu Items */}
            <div className="absolute inset-0 pointer-events-none z-[6]">
              {items.map((item, index) => {
                const position = getItemPosition(index, items.length);
                
                return (
                  <motion.button
                    key={item.id}
                    className="absolute glass-hierarchy-interactive glass-refraction rounded-full p-3 pointer-events-auto group hover:scale-110 transition-all duration-200"
                    style={{
                      left: `calc(50% + ${position.x}px)`,
                      top: `calc(50% + ${position.y}px)`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    initial={{ 
                      scale: 0, 
                      opacity: 0,
                      x: 0,
                      y: 0
                    }}
                    animate={{ 
                      scale: 1, 
                      opacity: 1,
                      x: position.x,
                      y: position.y
                    }}
                    exit={{ 
                      scale: 0, 
                      opacity: 0,
                      x: 0,
                      y: 0
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                      delay: index * 0.05
                    }}
                    onClick={() => handleItemClick(item)}
                    whileHover={{ 
                      scale: 1.2,
                      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)"
                    }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <div className={cn("transition-colors duration-200", item.color)}>
                      {item.icon}
                    </div>
                    
                    {/* Tooltip */}
                    <motion.div
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                      initial={{ opacity: 0, y: 10 }}
                      whileHover={{ opacity: 1, y: 0 }}
                    >
                      {item.label}
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RadialContextMenu;