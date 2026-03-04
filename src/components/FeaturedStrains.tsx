import { motion } from 'framer-motion';
import { ArrowRight, Leaf, Droplets, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useProducts, Product } from '@/hooks/useProducts';
import { useShop } from '@/context/ShopContext';
import { formatPrice } from '@/lib/currency';
import { PriceBreakdownTooltip } from '@/components/shop/PriceBreakdownTooltip';

export function FeaturedStrains() {
  const navigate = useNavigate();
  const { countryCode, addToCart, isEligible } = useShop();
  const { products, isLoading } = useProducts(countryCode);

  // Show max 4 available strains
  const featured = products.filter(p => p.availability).slice(0, 4);

  if (isLoading) {
    return (
      <section className="py-16 lg:py-24 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="h-8 w-64 bg-muted/50 rounded-lg animate-pulse mx-auto mb-12" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (featured.length === 0) return null;

  const handleQuickAdd = (product: Product) => {
    addToCart({
      strain_id: product.id,
      strain_name: product.name,
      quantity: 1,
      unit_price: product.retailPrice,
    });
  };

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Your Dispensary
            </span>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              Featured Strains
            </h2>
            <p className="font-body text-muted-foreground max-w-xl mx-auto">
              Pharmaceutical-grade medical cannabis, lab-tested and ready for delivery.
            </p>
          </motion.div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {featured.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -6 }}
                className="group cursor-pointer"
                onClick={() => navigate(`/shop/strain/${product.id}`)}
              >
                <div className="relative h-full overflow-hidden rounded-2xl bg-card border border-border/50 shadow-lg hover:shadow-xl hover:shadow-primary/10 transition-all duration-500">
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden bg-muted/30">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                    {/* Category badge */}
                    <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm border ${
                      product.category.toLowerCase() === 'sativa'
                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/30'
                        : product.category.toLowerCase() === 'indica'
                        ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-400/30'
                        : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/30'
                    }`}>
                      {product.category}
                    </div>
                    {/* High potency badge */}
                    {product.thcContent >= 25 && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-400/30">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm md:text-base text-foreground leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                      <PriceBreakdownTooltip>
                        <span className="text-base md:text-lg font-bold text-primary shrink-0">
                          {formatPrice(product.retailPrice, countryCode)}
                        </span>
                      </PriceBreakdownTooltip>
                    </div>

                    {/* THC/CBD compact */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <Leaf className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{product.thcContent.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20">
                        <Droplets className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{product.cbdContent.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Quick add button */}
                    {isEligible && (
                      <Button
                        size="sm"
                        className="w-full rounded-xl text-xs font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickAdd(product);
                        }}
                      >
                        Add to Cart
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* View All CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-10"
          >
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/shop')}
              className="group"
            >
              View All Strains
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}