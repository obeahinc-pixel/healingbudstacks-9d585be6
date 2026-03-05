/**
 * Commerce SDK — Sovereign Truth Library
 * 
 * Single source of truth for all pricing logic across the platform.
 * All products use `retailPrice` from the Dr. Green API (pre-calculated local currency).
 * No currency conversion, no fallback chains.
 */

export interface PricedItem {
  strain_id: string;
  strain_name: string;
  quantity: number;
  unit_price: number;
}

export interface CartValidationResult {
  corrected: PricedItem[];
  hasDrift: boolean;
  blocked: PricedItem[];
}

/**
 * PriceTruth — the canonical price cache.
 * Fed by useProducts after API fetch; consumed by Cart, Checkout, and all display components.
 */
export const PriceTruth = {
  /** In-memory cache: strain_id → retailPrice (local currency, per gram) */
  cache: new Map<string, number>(),
  
  /** Timestamp of last price refresh */
  lastRefreshed: 0,

  /**
   * Populate the cache from a product fetch.
   * Called once after useProducts resolves.
   */
  setPrices(products: { id: string; retailPrice: number }[]): void {
    for (const p of products) {
      if (p.id && typeof p.retailPrice === 'number') {
        PriceTruth.cache.set(p.id, p.retailPrice);
      }
    }
    PriceTruth.lastRefreshed = Date.now();
  },

  /**
   * Get the authoritative price for a strain.
   * Returns 0 if unknown (caller must handle).
   */
  getPrice(strainId: string): number {
    return PriceTruth.cache.get(strainId) ?? 0;
  },

  /**
   * Calculate line total: price × grams.
   * Returns 0 if price is unknown.
   */
  calculateLineTotal(strainId: string, grams: number): number {
    const price = PriceTruth.getPrice(strainId);
    return price * grams;
  },

  /**
   * Validate a cart against the truth cache.
   * - `corrected`: items with unit_price overridden to truth price
   * - `hasDrift`: true if any item's stored price differed from truth
   * - `blocked`: items where truth price is 0 (unknown/unavailable)
   */
  validateCart(cart: PricedItem[]): CartValidationResult {
    const corrected: PricedItem[] = [];
    const blocked: PricedItem[] = [];
    let hasDrift = false;

    for (const item of cart) {
      const truthPrice = PriceTruth.getPrice(item.strain_id);

      if (truthPrice === 0) {
        // Price unknown — block this item
        blocked.push(item);
        continue;
      }

      if (item.unit_price !== truthPrice) {
        hasDrift = true;
      }

      corrected.push({
        ...item,
        unit_price: truthPrice,
      });
    }

    return { corrected, hasDrift, blocked };
  },
};
