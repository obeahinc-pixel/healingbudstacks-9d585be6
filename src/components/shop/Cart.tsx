import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, X, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useShop } from '@/context/ShopContext';
import { Link } from 'react-router-dom';
import { formatPrice } from '@/lib/currency';
import { PriceBreakdownTooltip } from './PriceBreakdownTooltip';
import { useUserRole } from '@/hooks/useUserRole';

export function Cart() {
  const {
    cart,
    cartTotal,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateQuantity,
    isEligible,
    drGreenClient,
    isLoading,
    countryCode,
  } = useShop();

  const getEligibilityStatus = () => {
    if (!drGreenClient) {
      return {
        message: 'Complete registration to checkout',
        canCheckout: false,
      };
    }
    if (!drGreenClient.is_kyc_verified) {
      return {
        message: 'KYC verification pending',
        canCheckout: false,
      };
    }
    if (drGreenClient.admin_approval !== 'VERIFIED') {
      return {
        message: `Medical approval: ${drGreenClient.admin_approval}`,
        canCheckout: false,
      };
    }
    return {
      message: 'Verified medical patient',
      canCheckout: true,
    };
  };

  const { isAdmin } = useUserRole();

  const eligibility = isAdmin
    ? { message: 'Admin access — checkout enabled', canCheckout: true }
    : getEligibilityStatus();

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Your Cart
            {cart.length > 0 && (
              <Badge variant="secondary">{cart.length}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="font-medium text-lg mb-2">Your cart is empty</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Browse our selection of medical cannabis strains
              </p>
              <Button variant="outline" onClick={() => setIsCartOpen(false)}>
                Continue Shopping
              </Button>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <div className="space-y-4">
                {cart.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex gap-4 p-4 rounded-lg bg-muted/30"
                  >
                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">
                        {item.strain_name}
                      </h4>
                      <PriceBreakdownTooltip>
                        <p className="text-sm text-muted-foreground">
                          {formatPrice(item.unit_price, countryCode)} / gram
                        </p>
                      </PriceBreakdownTooltip>
                      
                      {/* Denomination selector */}
                      <div className="flex items-center gap-1.5 mt-2">
                        {[2, 5, 10].map((d) => (
                          <Button
                            key={d}
                            size="sm"
                            variant={item.quantity === d ? "default" : "outline"}
                            className="h-7 px-2.5 text-xs font-bold"
                            onClick={() => updateQuantity(item.strain_id, d)}
                          >
                            {d}g
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Price and remove */}
                    <div className="flex flex-col items-end justify-between">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeFromCart(item.strain_id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <span className="font-semibold text-foreground">
                        {formatPrice(item.unit_price * item.quantity, countryCode)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>

        {cart.length > 0 && (
          <SheetFooter className="flex-col gap-4 sm:flex-col">
            <Separator />
            
            {/* Eligibility status */}
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                eligibility.canCheckout
                  ? 'bg-primary/10 text-primary'
                  : 'bg-yellow-500/10 text-yellow-600'
              }`}
            >
              {eligibility.canCheckout ? (
                <ShieldCheck className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="text-sm">{eligibility.message}</span>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between w-full">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-xl font-bold text-foreground">
                {formatPrice(cartTotal, countryCode)}
              </span>
            </div>

            {/* Checkout button */}
            {eligibility.canCheckout ? (
              <Button className="w-full" size="lg" asChild>
                <Link to="/checkout" onClick={() => setIsCartOpen(false)}>
                  Proceed to Checkout
                </Link>
              </Button>
            ) : (
              <Button className="w-full" size="lg" variant="secondary" asChild>
                <Link to="/shop/register" onClick={() => setIsCartOpen(false)}>
                  Complete Registration
                </Link>
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
