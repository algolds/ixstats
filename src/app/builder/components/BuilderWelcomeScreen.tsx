"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Carousel, Card, BlurImage } from '~/components/ui/apple-cards-carousel';
import { Button } from '~/components/ui/button';
import { ArrowRight } from 'lucide-react';

const welcomeCards = [
  {
    src: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    title: 'Build Your Nation',
    category: 'Welcome to the Builder',
    content: (
      <div>
        <p className="text-neutral-600 dark:text-neutral-400 text-base">
          Create a new country from scratch using powerful economic modeling tools. Define your nation's identity, from its economic foundations to its national symbols.
        </p>
      </div>
    ),
  },
  {
    src: 'https://images.unsplash.com/photo-1580465446361-8aae73927e64?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    title: 'Import Existing Data',
    category: 'Advanced Mode',
    content: (
      <div>
        <p className="text-neutral-600 dark:text-neutral-400 text-base">
          Have a spreadsheet with your country's data? Import it directly to get started quickly and see your nation come to life.
        </p>
      </div>
    ),
  },
  {
    src: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    title: 'Guided Experience',
    category: 'For New Users',
    content: (
      <div>
        <p className="text-neutral-600 dark:text-neutral-400 text-base">
          Not sure where to start? Our guided process will walk you through each step of creating a vibrant and realistic country.
        </p>
      </div>
    ),
  },
];

interface BuilderWelcomeScreenProps {
  onStartBuilding: () => void;
}

export const BuilderWelcomeScreen = ({ onStartBuilding }: BuilderWelcomeScreenProps) => {
  const cards = welcomeCards.map((card, index) => (
    <Card card={card} key={index} index={0} />
  ));

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-grid-black/[0.05] dark:bg-grid-white/[0.05]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
        className="text-center px-4 pt-10"
      >
        <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 to-neutral-500 dark:from-white dark:to-neutral-400">
          MyCountry Builder
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto">
          The ultimate sandbox for crafting nations. Forge economies, define cultures, and shape the world.
        </p>
        
      </motion.div>

      <Carousel items={cards} />

      <motion.div
         initial={{ opacity: 0, y: -20 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.8, ease: 'easeInOut', delay: 0.5 }}
      >
        <Button onClick={onStartBuilding} size="lg" className="mt-8 group">
          Start Building
          <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
      </motion.div>
    </div>
  );
};
