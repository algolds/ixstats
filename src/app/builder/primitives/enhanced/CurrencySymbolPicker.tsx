"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '~/lib/utils';
import { useSectionTheme, getGlassClasses } from './theme-utils';
import type { SectionId } from './types';

interface CurrencySymbol {
  symbol: string;
  name: string;
  code?: string;
  description?: string;
}

// Comprehensive list of currency symbols
const CURRENCY_SYMBOLS: CurrencySymbol[] = [
  // Major currencies
  { symbol: '$', name: 'Dollar', code: 'USD', description: 'US Dollar' },
  { symbol: '€', name: 'Euro', code: 'EUR', description: 'European Euro' },
  { symbol: '£', name: 'Pound', code: 'GBP', description: 'British Pound' },
  { symbol: '¥', name: 'Yen', code: 'JPY', description: 'Japanese Yen' },
  { symbol: '₹', name: 'Rupee', code: 'INR', description: 'Indian Rupee' },
  { symbol: '₽', name: 'Ruble', code: 'RUB', description: 'Russian Ruble' },
  { symbol: '¢', name: 'Cent', description: 'Cent sign' },
  { symbol: '₩', name: 'Won', code: 'KRW', description: 'Korean Won' },
  { symbol: '₪', name: 'Shekel', code: 'ILS', description: 'Israeli Shekel' },
  { symbol: '₨', name: 'Rupee', code: 'PKR', description: 'Pakistani Rupee' },
  
  // Other major currencies
  { symbol: '₦', name: 'Naira', code: 'NGN', description: 'Nigerian Naira' },
  { symbol: '₡', name: 'Colón', code: 'CRC', description: 'Costa Rican Colón' },
  { symbol: '₫', name: 'Dong', code: 'VND', description: 'Vietnamese Dong' },
  { symbol: '₱', name: 'Peso', code: 'PHP', description: 'Philippine Peso' },
  { symbol: '₲', name: 'Guaraní', code: 'PYG', description: 'Paraguayan Guaraní' },
  { symbol: '₴', name: 'Hryvnia', code: 'UAH', description: 'Ukrainian Hryvnia' },
  { symbol: '₵', name: 'Cedi', code: 'GHS', description: 'Ghanaian Cedi' },
  { symbol: '₶', name: 'Livre', description: 'French Livre' },
  { symbol: '₷', name: 'Spesmilo', description: 'Spesmilo' },
  { symbol: '₸', name: 'Tenge', code: 'KZT', description: 'Kazakhstani Tenge' },
  { symbol: '₺', name: 'Lira', code: 'TRY', description: 'Turkish Lira' },
  { symbol: '₻', name: 'Nordic Mark', description: 'Nordic Mark' },
  { symbol: '₼', name: 'Manat', code: 'AZN', description: 'Azerbaijani Manat' },
  { symbol: '₾', name: 'Lari', code: 'GEL', description: 'Georgian Lari' },
  { symbol: '₿', name: 'Bitcoin', code: 'BTC', description: 'Bitcoin' },
  
  // Historical and alternative symbols
  { symbol: '＄', name: 'Fullwidth Dollar', description: 'Fullwidth Dollar Sign' },
  { symbol: '¤', name: 'Generic Currency', description: 'Generic Currency Symbol' },
  { symbol: '؋', name: 'Afghani', code: 'AFN', description: 'Afghan Afghani' },
  { symbol: '₳', name: 'Austral', description: 'Argentine Austral' },
  { symbol: '₮', name: 'Tugrik', code: 'MNT', description: 'Mongolian Tugrik' },
  { symbol: '₯', name: 'Drachma', description: 'Greek Drachma' },
  { symbol: '₰', name: 'Pfennig', description: 'German Pfennig' },

  // Regional variations
  { symbol: 'R$', name: 'Real', code: 'BRL', description: 'Brazilian Real' },
  { symbol: 'CA$', name: 'Canadian Dollar', code: 'CAD', description: 'Canadian Dollar' },
  { symbol: 'A$', name: 'Australian Dollar', code: 'AUD', description: 'Australian Dollar' },
  { symbol: 'NZ$', name: 'New Zealand Dollar', code: 'NZD', description: 'New Zealand Dollar' },
  { symbol: 'S$', name: 'Singapore Dollar', code: 'SGD', description: 'Singapore Dollar' },
  { symbol: 'HK$', name: 'Hong Kong Dollar', code: 'HKD', description: 'Hong Kong Dollar' },
  { symbol: 'NT$', name: 'New Taiwan Dollar', code: 'TWD', description: 'New Taiwan Dollar' },
  { symbol: 'MX$', name: 'Mexican Peso', code: 'MXN', description: 'Mexican Peso' },
  { symbol: 'AR$', name: 'Argentine Peso', code: 'ARS', description: 'Argentine Peso' },
  { symbol: 'CL$', name: 'Chilean Peso', code: 'CLP', description: 'Chilean Peso' },
  { symbol: 'CO$', name: 'Colombian Peso', code: 'COP', description: 'Colombian Peso' },
  
  // Fictional/Game currencies
  { symbol: '⚡', name: 'Energy', description: 'Energy Currency' },
  { symbol: '💎', name: 'Gems', description: 'Gem Currency' },
  { symbol: '🪙', name: 'Coins', description: 'Coin Currency' },
  { symbol: '⭐', name: 'Stars', description: 'Star Currency' },
  { symbol: '🔥', name: 'Fire', description: 'Fire Currency' },
  { symbol: '❄️', name: 'Ice', description: 'Ice Currency' },
  { symbol: '🌟', name: 'Stellar', description: 'Stellar Currency' },
];

interface CurrencySymbolPickerProps {
  value: string;
  onSymbolSelect: (symbol: string) => void;
  sectionId?: SectionId;
  className?: string;
}

export function CurrencySymbolPicker({
  value,
  onSymbolSelect,
  sectionId,
  className
}: CurrencySymbolPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState(value || '$');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { theme: resolvedTheme, colors, cssVars } = useSectionTheme(sectionId);

  // Filter symbols based on search term
  const filteredSymbols = CURRENCY_SYMBOLS.filter(
    currency =>
      currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      currency.symbol.includes(searchTerm) ||
      currency.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      currency.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    onSymbolSelect(symbol);
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectedCurrency = CURRENCY_SYMBOLS.find(c => c.symbol === selectedSymbol);

  return (
    <div 
      className={cn('relative', className)}
      style={cssVars as React.CSSProperties}
      ref={dropdownRef}
    >
      {/* Trigger Button */}
      <motion.button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'flex items-center justify-between w-full px-4 py-3 rounded-lg transition-all duration-200',
          getGlassClasses('elevated', resolvedTheme, sectionId),
          'bg-white/80 dark:bg-gray-800/90 border-2',
          'border-gray-200/50 dark:border-gray-600/50',
          'hover:border-gray-300/70 dark:hover:border-gray-500/70',
          'focus:border-[var(--primitive-primary)] focus:shadow-lg',
          'focus:shadow-[var(--primitive-primary)]/20'
        )}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-mono">{selectedSymbol}</span>
          <div className="text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedCurrency?.name || 'Custom'}
            </div>
            {selectedCurrency?.description && (
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {selectedCurrency.description}
              </div>
            )}
          </div>
        </div>
        <ChevronDown 
          className={cn(
            'h-4 w-4 text-gray-500 transition-transform duration-200',
            isOpen && 'rotate-180'
          )} 
        />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'absolute top-full left-0 right-0 mt-2 z-50',
              getGlassClasses('modal', resolvedTheme, sectionId),
              'bg-white/95 dark:bg-gray-800/95 border-2',
              'border-gray-200/50 dark:border-gray-600/50',
              'max-h-80 overflow-hidden'
            )}
          >
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200/30 dark:border-gray-600/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search currencies..."
                  className="w-full pl-10 pr-4 py-2 bg-transparent border border-gray-200/50 dark:border-gray-600/50 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-[var(--primitive-primary)] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Currency List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredSymbols.length > 0 ? (
                <div className="py-2">
                  {filteredSymbols.map((currency, index) => {
                    // Create unique key using symbol, code (if available), and index as fallback
                    const uniqueKey = currency.code 
                      ? `${currency.symbol}-${currency.code}` 
                      : `${currency.symbol}-${currency.name}-${index}`;
                    
                    return (
                    <motion.button
                      key={uniqueKey}
                      onClick={() => handleSymbolSelect(currency.symbol)}
                      whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                        'hover:bg-gray-100/50 dark:hover:bg-gray-700/50',
                        selectedSymbol === currency.symbol && 'bg-[var(--primitive-primary)]/10'
                      )}
                    >
                      <span className="text-lg font-mono">{currency.symbol}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {currency.name}
                          </span>
                          {currency.code && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-200/50 dark:bg-gray-700/50 rounded text-gray-600 dark:text-gray-300 font-mono">
                              {currency.code}
                            </span>
                          )}
                        </div>
                        {currency.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {currency.description}
                          </div>
                        )}
                      </div>
                      {selectedSymbol === currency.symbol && (
                        <Check className="h-4 w-4 text-[var(--primitive-primary)]" />
                      )}
                    </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No currencies found</p>
                  <p className="text-xs">Try a different search term</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}