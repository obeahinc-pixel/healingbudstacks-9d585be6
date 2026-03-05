/**
 * TruthProvider — React Context wrapper around PriceTruth (commerce.ts)
 * 
 * Exposes truth pricing functions to all components via useTruth() hook.
 */

import React, { createContext, useContext, useCallback, useState } from 'react';
import { PriceTruth, type PricedItem, type CartValidationResult } from '@/lib/commerce';

interface TruthContextType {
  /** Get the authoritative price for a strain */
  getTruthPrice: (strainId: string) => number;
  /** Calculate line total from truth cache */
  calculateLineTotal: (strainId: string, grams: number) => number;
  /** Validate cart items against truth prices */
  validateCartPrices: (cart: PricedItem[]) => CartValidationResult;
  /** Populate truth cache from products */
  setPrices: (products: { id: string; retailPrice: number }[]) => void;
  /** Timestamp of last price refresh */
  lastRefreshed: number;
}

const TruthContext = createContext<TruthContextType | undefined>(undefined);

export function TruthProvider({ children }: { children: React.ReactNode }) {
  const [lastRefreshed, setLastRefreshed] = useState(0);

  const setPrices = useCallback((products: { id: string; retailPrice: number }[]) => {
    PriceTruth.setPrices(products);
    setLastRefreshed(Date.now());
  }, []);

  const getTruthPrice = useCallback((strainId: string) => {
    return PriceTruth.getPrice(strainId);
  }, []);

  const calculateLineTotal = useCallback((strainId: string, grams: number) => {
    return PriceTruth.calculateLineTotal(strainId, grams);
  }, []);

  const validateCartPrices = useCallback((cart: PricedItem[]) => {
    return PriceTruth.validateCart(cart);
  }, []);

  return (
    <TruthContext.Provider value={{
      getTruthPrice,
      calculateLineTotal,
      validateCartPrices,
      setPrices,
      lastRefreshed,
    }}>
      {children}
    </TruthContext.Provider>
  );
}

export function useTruth() {
  const context = useContext(TruthContext);
  if (context === undefined) {
    throw new Error('useTruth must be used within a TruthProvider');
  }
  return context;
}
