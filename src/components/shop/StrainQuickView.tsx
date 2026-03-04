import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  X, Leaf, Droplets, Minus, Plus, ShoppingCart, Wind, 
  Sparkles, Heart, Clock, ExternalLink, Star, Beaker
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useShop } from '@/context/ShopContext';
import { Product } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/currency';
import { PriceBreakdownTooltip } from './PriceBreakdownTooltip';

interface StrainQuickViewProps {
  product: Product | null;
  onClose: () => void;
}

export function StrainQuickView({ product, onClose }: StrainQuickViewProps) {
  const [quantity, setQuantity] = useState(1);
  const { addToCart, isEligible, drGreenClient, countryCode } = useShop();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAddToCart = () => {
    if (!product) return;
    
    if (!drGreenClient) {
      toast({
        title: "Registration Required",
        description: "Please register as a patient to purchase.",
        variant: "destructive",
      });
      navigate('/shop/register');
      return;
    }

    if (!isEligible) {
      toast({
        title: "Verification Pending",
        description: "Complete KYC verification to purchase.",
        variant: "destructive",
      });
      return;
    }

    addToCart({
      strain_id: product.id,
      strain_name: product.name,
      quantity,
      unit_price: product.retailPrice,
    });
    toast({
      title: "Added to cart",
      description: `${quantity}g of ${product.name} added.`,
    });
    onClose();
  };

  const handleViewFullDetails = () => {
    if (!product) return;
    onClose();
    navigate(`/shop/strain/${product.id}`);
  };

  const getCategoryStyles = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'sativa':
        return {
          badge: 'bg-amber-500/25 text-amber-300 border-amber-400/40',
          glow: 'from-amber-500/20 via-transparent',
          accent: 'text-amber-400',
        };
      case 'indica':
        return {
          badge: 'bg-violet-500/25 text-violet-300 border-violet-400/40',
          glow: 'from-violet-500/20 via-transparent',
          accent: 'text-violet-400',
        };
      case 'hybrid':
        return {
          badge: 'bg-emerald-500/25 text-emerald-300 border-emerald-400/40',
          glow: 'from-emerald-500/20 via-transparent',
          accent: 'text-emerald-400',
        };
      case 'cbd':
        return {
          badge: 'bg-cyan-500/25 text-cyan-300 border-cyan-400/40',
          glow: 'from-cyan-500/20 via-transparent',
          accent: 'text-cyan-400',
        };
      default:
        return {
          badge: 'bg-slate-500/25 text-slate-300 border-slate-400/40',
          glow: 'from-slate-500/20 via-transparent',
          accent: 'text-slate-400',
        };
    }
  };

  const styles = product ? getCategoryStyles(product.category) : getCategoryStyles('');

  return (
    <Dialog open={!!product} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-card/98 backdrop-blur-2xl border-white/10 shadow-2xl">
        <AnimatePresence>
          {product && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="grid lg:grid-cols-2 max-h-[90vh] overflow-y-auto"
            >
              {/* Large Image Section */}
              <div className="relative aspect-square lg:aspect-auto lg:min-h-[500px] bg-gradient-to-br from-slate-900/50 to-slate-900/80 flex items-center justify-center overflow-hidden">
                {/* Ambient glow */}
                <div className={`absolute inset-0 bg-gradient-radial ${styles.glow} to-transparent opacity-40`} />
                <div className="absolute inset-[10%] rounded-full bg-gradient-radial from-white/8 via-white/2 to-transparent blur-3xl" />
                
                <motion.img
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.4 }}
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-[85%] h-[85%] object-contain relative z-10"
                  style={{ 
                    filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.6)) drop-shadow(0 10px 20px rgba(0,0,0,0.4))',
                  }}
                />
                
                {/* Category badge */}
                <Badge 
                  className={`absolute top-4 left-4 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider border ${styles.badge}`}
                >
                  {product.category}
                </Badge>

                {/* Potency indicator */}
                {product.thcContent >= 25 && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-400/30">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-300">High Potency</span>
                  </div>
                )}

                {/* Close button (mobile) */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-4 right-4 lg:hidden bg-black/20 backdrop-blur-sm hover:bg-black/40"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Content Section */}
              <div className="p-6 lg:p-8 flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-1">
                      {product.name}
                    </h2>
                    <p className="text-muted-foreground text-sm flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                      Premium Medical Strain
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="hidden lg:flex"
                    onClick={onClose}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Price - converted from EUR to user's currency */}
                <div className="flex items-baseline gap-2 mb-4">
                  <PriceBreakdownTooltip>
                    <span className="text-3xl font-bold text-primary">
                      {formatPrice(product.retailPrice, countryCode)}
                    </span>
                  </PriceBreakdownTooltip>
                  <span className="text-sm text-muted-foreground">per gram</span>
                </div>

                {/* Description */}
                <p className="text-muted-foreground leading-relaxed mb-6">
                  {product.description || 'A premium medical cannabis strain carefully cultivated for therapeutic benefits.'}
                </p>

                <Separator className="my-4 bg-white/10" />

                {/* Cannabinoid Content */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <Leaf className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-400/70 uppercase tracking-wide font-medium">THC</p>
                      <p className="text-xl font-bold text-emerald-400">{product.thcContent.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <Droplets className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-xs text-cyan-400/70 uppercase tracking-wide font-medium">CBD</p>
                      <p className="text-xl font-bold text-cyan-400">{product.cbdContent.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>

                {/* Effects */}
                {product.effects.length > 0 && (
                  <div className="mb-5">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                      <Wind className="h-4 w-4 text-primary" />
                      Effects
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {product.effects.map((effect) => (
                        <Badge 
                          key={effect} 
                          variant="secondary"
                          className="bg-white/5 border-white/10 text-foreground/80 px-3 py-1"
                        >
                          {effect}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Terpenes/Flavors */}
                {product.terpenes.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                      <Beaker className="h-4 w-4 text-primary" />
                      Flavor Profile
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {product.terpenes.map((terpene) => (
                        <Badge
                          key={terpene}
                          variant="outline"
                          className="bg-background/30 border-white/15 text-muted-foreground"
                        >
                          {terpene}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto space-y-4">
                  {/* Quantity selector */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div>
                      <span className="text-sm font-medium">Quantity</span>
                      <p className="text-xs text-muted-foreground">{product.stock}g available</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-lg"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center font-bold text-lg">
                        {quantity}g
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-lg"
                        onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                        disabled={quantity >= product.stock}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between text-lg">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(product.retailPrice * quantity, countryCode)}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1 h-12"
                      onClick={handleViewFullDetails}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Full Details
                    </Button>
                    <Button
                      className="flex-1 h-12 font-semibold"
                      disabled={!product.availability}
                      onClick={handleAddToCart}
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      {product.availability ? 'Add to Cart' : 'Out of Stock'}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
