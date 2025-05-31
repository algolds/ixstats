// src/lib/format.ts
export const formatNumber = (
    num: number | null | undefined,
    isCurrency = false,
    precisionForNonCompactOrSmallNum = 2,
    compact = false
  ): string => {
    // Handle null/undefined/NaN cases
    if (num == null || isNaN(num) || !isFinite(num)) {
      if (isCurrency) return compact ? '$0' : '$0.00';
      return '0';
    }
  
    // Handle edge cases for very large or very small numbers
    if (Math.abs(num) > 1e50) {
      return isCurrency ? '$∞' : '∞';
    }
    
    if (Math.abs(num) < 1e-10 && num !== 0) {
      return isCurrency ? '$0' : '0';
    }
  
    if (compact) {
      const absNum = Math.abs(num);
      let valToShow: number;
      let suffix = '';
      let fixedPrecision: number;
  
      if (absNum >= 1e12) {
        valToShow = num / 1e12;
        suffix = 'T';
        fixedPrecision = 2;
      } else if (absNum >= 10e9) {
        valToShow = num / 1e9;
        suffix = 'B';
        fixedPrecision = 2;
      } else if (absNum >= 1e9) {
        valToShow = num / 1e9;
        suffix = 'B';
        fixedPrecision = 1;
      } else if (absNum >= 1e6) {
        valToShow = num / 1e6;
        suffix = 'M';
        fixedPrecision = 1;
      } else if (absNum >= 1e3) {
        valToShow = num / 1e3;
        suffix = 'K';
        fixedPrecision = 0;
      } else {
        fixedPrecision = isCurrency ? precisionForNonCompactOrSmallNum : 0;
        return `${isCurrency ? '$' : ''}${num.toLocaleString(undefined, {
          minimumFractionDigits: fixedPrecision,
          maximumFractionDigits: fixedPrecision,
        })}`;
      }
      
      if (!isFinite(valToShow)) {
        return isCurrency ? '$∞' : '∞';
      }
      
      return `${isCurrency ? '$' : ''}${valToShow.toFixed(fixedPrecision)}${suffix}`;
    }
  
    // Non-compact formatting
    try {
      return `${isCurrency ? '$' : ''}${num.toLocaleString(undefined, {
        minimumFractionDigits: (isCurrency && num !== 0) ? precisionForNonCompactOrSmallNum : (num === 0 ? 0 : precisionForNonCompactOrSmallNum),
        maximumFractionDigits: precisionForNonCompactOrSmallNum,
      })}`;
    } catch (error) {
      console.warn('Error formatting number:', num, error);
      return isCurrency ? '$0' : '0';
    }
  };
  