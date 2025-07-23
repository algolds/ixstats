import React, { useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';

interface Module {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const modules: Module[] = [
  { id: 'stats', label: 'Global Stats', icon: '📊', color: 'bg-blue-600/80 text-white' },
  { id: 'intel', label: 'Intelligence Feed', icon: '🛰️', color: 'bg-purple-600/80 text-white' },
  { id: 'comms', label: 'Secure Comms', icon: '🔒', color: 'bg-green-600/80 text-white' },
  { id: 'switch', label: 'Module Switcher', icon: '🔄', color: 'bg-yellow-500/80 text-white' },
];

export default function FloatingDock() {
  const [active, setActive] = useState<string>('stats');
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <motion.div
        onMouseMove={e => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="mx-auto flex h-16 items-end gap-4 rounded-2xl glass-card px-4 pb-3"
      >
        {modules.map((mod) => (
          <IconContainer
            key={mod.id}
            mouseX={mouseX}
            label={mod.label}
            icon={mod.icon}
            id={mod.id}
            color={mod.color}
            active={active === mod.id}
            setActive={() => setActive(mod.id)}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

interface IconContainerProps {
  mouseX: MotionValue<number>;
  label: string;
  icon: React.ReactNode;
  id: string;
  color: string;
  active: boolean;
  setActive: () => void;
}

function IconContainer({ mouseX, label, icon, id, color, active, setActive }: IconContainerProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (val: number) => {
    if (!ref.current) return Infinity;
    const bounds = ref.current.getBoundingClientRect();
    return val - bounds.x - bounds.width / 2;
  });

  const widthTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  const heightTransform = useTransform(distance, [-150, 0, 150], [40, 80, 40]);
  const widthIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);
  const heightIcon = useTransform(distance, [-150, 0, 150], [20, 40, 20]);

  const width = useSpring(widthTransform, { mass: 0.1, stiffness: 150, damping: 12 });
  const height = useSpring(heightTransform, { mass: 0.1, stiffness: 150, damping: 12 });
  const widthIconSpring = useSpring(widthIcon, { mass: 0.1, stiffness: 150, damping: 12 });
  const heightIconSpring = useSpring(heightIcon, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <button
      ref={ref}
      onClick={setActive}
      className={`relative flex aspect-square items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 ${active ? color : 'bg-gray-200 dark:bg-neutral-800 text-gray-700 dark:text-gray-200'}`}
      style={{ border: 'none', padding: 0, cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      type="button"
    >
      <motion.div
        style={{ width, height }}
        className="flex items-center justify-center rounded-full"
        initial={false}
        animate={false}
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: 2, x: '-50%' }}
              className="absolute -top-8 left-1/2 w-fit rounded-md border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 dark:border-neutral-900 dark:bg-neutral-800 dark:text-white shadow"
            >
              {label}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.span
          style={{ width: widthIconSpring, height: heightIconSpring }}
          className="flex items-center justify-center text-2xl md:text-3xl"
          initial={false}
          animate={false}
        >
          {icon}
        </motion.span>
      </motion.div>
    </button>
  );
} 