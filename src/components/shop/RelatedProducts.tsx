import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/hooks/useProducts';
import { formatPrice } from '@/lib/currency';

import { PriceBreakdownTooltip } from './PriceBreakdownTooltip';

interface RelatedProductsProps {
  products: Product[];
  currentProductId: string;
  countryCode: string;
}

export function RelatedProducts({ products, currentProductId, countryCode }: RelatedProductsProps) {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  

  // Filter out current product and get available products
  const relatedProducts = products.filter(p => p.id !== currentProductId);

  if (relatedProducts.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'sativa':
        return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-400/30';
      case 'indica':
        return 'bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-400/30';
      case 'hybrid':
        return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-400/30';
      case 'cbd':
        return 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-400/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="mt-12 py-8 bg-muted/30 dark:bg-white/5 border-t border-b border-border/30 dark:border-white/10">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">More Strains</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-border/50 hover:bg-accent"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full border-border/50 hover:bg-accent"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Responsive Grid Container - fills across with no gaps */}
        <div
          ref={scrollContainerRef}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4"
        >
          {relatedProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
              className="w-full"
            >
              <button
                onClick={() => navigate(`/shop/cultivar/${product.id}`)}
                className="w-full group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
              >
                {/* Image Container */}
                <div className="relative aspect-square rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/60 dark:to-slate-900/80 border border-border/30 overflow-hidden mb-2 group-hover:border-primary/40 group-hover:shadow-lg transition-all duration-300">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Category badge */}
                  <Badge
                    className={`absolute top-1.5 left-1.5 sm:top-2 sm:left-2 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold uppercase ${getCategoryColor(product.category)}`}
                  >
                    {product.category}
                  </Badge>

                  {/* Out of stock overlay */}
                  {!product.availability && (
                    <div className="absolute bottom-0 left-0 right-0 bg-sky-600/90 py-1 text-center">
                      <span className="text-[9px] sm:text-[10px] font-semibold text-white uppercase">Out of Stock</span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <h4 className="text-xs sm:text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {product.name}
                </h4>
                <PriceBreakdownTooltip>
                  <p className="text-xs sm:text-sm font-semibold text-primary">
                    {formatPrice(product.retailPrice, countryCode)}
                  </p>
                </PriceBreakdownTooltip>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
