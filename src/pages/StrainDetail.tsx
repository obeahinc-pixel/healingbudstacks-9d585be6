import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, Leaf, Droplets, ShoppingCart, 
  Wind, Beaker, Heart, Clock, Shield, Star, Sparkles,
  AlertCircle, CheckCircle2, Info, Stethoscope, Pill, 
  AlertTriangle, Users, Timer, BookOpen, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import Header from '@/layout/Header';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';
import { useProducts, Product } from '@/hooks/useProducts';
import { useShop } from '@/context/ShopContext';
import { useStrainMedicalInfo } from '@/hooks/useStrainMedicalInfo';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/currency';
import { RelatedProducts } from '@/components/shop/RelatedProducts';
import { PriceBreakdownTooltip } from '@/components/shop/PriceBreakdownTooltip';
import { Cart } from '@/components/shop/Cart';
import { FloatingCartButton } from '@/components/shop/FloatingCartButton';

export default function StrainDetail() {
  const { strainId } = useParams<{ strainId: string }>();
  const navigate = useNavigate();
  const { addToCart, isEligible, drGreenClient, countryCode } = useShop();
  const { products, isLoading } = useProducts(countryCode);
  const { toast } = useToast();
  const DENOMINATIONS = [2, 5, 10] as const;
  const [selectedDenomination, setSelectedDenomination] = useState<number>(2);
  const [product, setProduct] = useState<Product | null>(null);
  
  // Fetch AI-enhanced medical information
  const { medicalInfo, isLoading: isMedicalLoading } = useStrainMedicalInfo(product);

  useEffect(() => {
    if (!isLoading && products.length > 0) {
      const found = products.find(p => p.id === strainId);
      setProduct(found || null);
    }
  }, [products, strainId, isLoading]);

  const handleAddToCart = () => {
    if (!product) return;
    
    if (!drGreenClient) {
      toast({
        title: "Registration Required",
        description: "Please register as a patient to purchase medical cannabis.",
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
      quantity: selectedDenomination,
      unit_price: product.retailPrice,
    });
    toast({
      title: "Added to cart",
      description: `${selectedDenomination}g of ${product.name} added to your cart.`,
    });
  };

  const getCategoryStyles = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'sativa':
        return {
          badge: 'bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-400/40',
          gradient: 'from-amber-500/30 via-amber-500/5',
          accent: 'text-amber-600 dark:text-amber-400',
          ring: 'ring-amber-500/30',
        };
      case 'indica':
        return {
          badge: 'bg-violet-500/25 text-violet-700 dark:text-violet-300 border-violet-400/40',
          gradient: 'from-violet-500/30 via-violet-500/5',
          accent: 'text-violet-600 dark:text-violet-400',
          ring: 'ring-violet-500/30',
        };
      case 'hybrid':
        return {
          badge: 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-400/40',
          gradient: 'from-emerald-500/30 via-emerald-500/5',
          accent: 'text-emerald-600 dark:text-emerald-400',
          ring: 'ring-emerald-500/30',
        };
      case 'cbd':
        return {
          badge: 'bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border-cyan-400/40',
          gradient: 'from-cyan-500/30 via-cyan-500/5',
          accent: 'text-cyan-600 dark:text-cyan-400',
          ring: 'ring-cyan-500/30',
        };
      default:
        return {
          badge: 'bg-slate-500/25 text-slate-700 dark:text-slate-300 border-slate-400/40',
          gradient: 'from-slate-500/30 via-slate-500/5',
          accent: 'text-slate-600 dark:text-slate-400',
          ring: 'ring-slate-500/30',
        };
    }
  };

  if (isLoading) {
    return (
      <PageTransition variant="premium">
        <Header />
        <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading strain details...</div>
        </div>
        <Footer />
      </PageTransition>
    );
  }

  if (!product) {
    return (
      <PageTransition variant="premium">
        <Header />
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <AlertCircle className="h-16 w-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Strain Not Found</h1>
          <p className="text-muted-foreground">The strain you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/shop')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dispensary
          </Button>
        </div>
        <Footer />
      </PageTransition>
    );
  }

  const styles = getCategoryStyles(product.category);

  // Category descriptions for education
  const categoryInfo: Record<string, { title: string; description: string; benefits: string[] }> = {
    sativa: {
      title: 'Sativa Dominant',
      description: 'Sativa strains are known for their energizing and uplifting effects. They typically produce a cerebral, creative high that\'s great for daytime use.',
      benefits: ['Increased energy', 'Enhanced creativity', 'Mood elevation', 'Focus improvement'],
    },
    indica: {
      title: 'Indica Dominant',
      description: 'Indica strains provide deep relaxation and calming effects. They\'re ideal for evening use, helping with sleep and physical discomfort.',
      benefits: ['Deep relaxation', 'Pain relief', 'Sleep aid', 'Muscle relaxation'],
    },
    hybrid: {
      title: 'Hybrid Balance',
      description: 'Hybrid strains combine the best of both Sativa and Indica genetics, offering a balanced experience that can be tailored to your needs.',
      benefits: ['Balanced effects', 'Versatile use', 'Customized experience', 'Best of both worlds'],
    },
    cbd: {
      title: 'CBD Rich',
      description: 'CBD-dominant strains provide therapeutic benefits without significant psychoactive effects. Ideal for medical patients seeking relief.',
      benefits: ['Non-intoxicating', 'Anti-inflammatory', 'Anxiety relief', 'Therapeutic'],
    },
  };

  const currentCategoryInfo = categoryInfo[product.category.toLowerCase()] || categoryInfo.hybrid;

  return (
    <PageTransition variant="premium">
      <Helmet>
        <title>{product.name} | Medical Cannabis Strain | HealingBuds</title>
        <meta name="description" content={product.description || `${product.name} - A premium ${product.category} strain with ${product.thcContent}% THC and ${product.cbdContent}% CBD. Available at HealingBuds dispensary.`} />
      </Helmet>
      
      <Header />
      
      {/* Spacer for fixed header separation */}
      <div className="h-28 lg:h-32" />
      
      <main className="min-h-screen bg-background">
        {/* Hero Section with Image */}
        <section className={`relative overflow-hidden bg-gradient-to-b ${styles.gradient} to-background`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
          
          <div className="container mx-auto px-4 py-8 lg:py-16">
            {/* Back button */}
            <Button 
              variant="ghost" 
              className="mb-6 text-muted-foreground hover:text-foreground"
              onClick={() => navigate('/shop')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dispensary
            </Button>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12 items-start">
              {/* Product Image */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <div className="relative aspect-square">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Badges */}
                  <Badge 
                    className={`absolute top-4 left-4 px-4 py-1.5 text-sm font-semibold uppercase tracking-wider border ${styles.badge}`}
                  >
                    {product.category}
                  </Badge>

                  {product.thcContent >= 25 && product.availability && (
                    <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-2 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-400/30">
                      <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-300">High Potency</span>
                    </div>
                  )}

                  {/* Out of stock banner at bottom */}
                  {!product.availability && (
                    <div className="absolute bottom-0 left-0 right-0 bg-sky-600/90 backdrop-blur-sm py-3 px-4 flex items-center justify-center">
                      <span className="text-base font-semibold text-white uppercase tracking-wide">Out of Stock</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Product Info */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="space-y-6"
              >
                {/* Title & Rating */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                    <span className="text-sm text-muted-foreground">Premium Medical Strain</span>
                  </div>
                  <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-3">
                    {product.name}
                  </h1>
                  <p className="text-xl text-muted-foreground leading-relaxed">
                    {product.description || 'A carefully cultivated medical cannabis variety selected for its exceptional therapeutic properties and consistent quality.'}
                  </p>
                </div>

                {/* Price - converted from EUR to user's currency */}
                <div className="flex items-baseline gap-3">
                  <PriceBreakdownTooltip>
                    <span className="text-4xl font-bold text-primary">
                      {formatPrice(product.retailPrice, countryCode)}
                    </span>
                  </PriceBreakdownTooltip>
                  <span className="text-lg text-muted-foreground">per gram</span>
                </div>

                {/* Cannabinoid Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2.5 rounded-xl bg-emerald-500/20">
                        <Leaf className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wide font-medium">THC Content</p>
                        <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{product.thcContent.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2.5 rounded-xl bg-cyan-500/20">
                        <Droplets className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <p className="text-xs text-cyan-600/70 dark:text-cyan-400/70 uppercase tracking-wide font-medium">CBD Content</p>
                        <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{product.cbdContent.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add to Cart */}
                <div className="p-6 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold">Select Weight</span>
                        <p className="text-sm text-muted-foreground">{product.stock}g in stock</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {DENOMINATIONS.map((d) => (
                        <Button
                          key={d}
                          variant={selectedDenomination === d ? "default" : "outline"}
                          className="flex-1 h-12 rounded-xl text-lg font-bold"
                          onClick={() => setSelectedDenomination(d)}
                        >
                          {d}g
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <Separator className="bg-border/50 dark:bg-white/10" />
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="text-3xl font-bold text-primary">
                      {formatPrice(product.retailPrice * selectedDenomination, countryCode)}
                    </span>
                  </div>

                  <Button
                    className="w-full h-14 text-lg font-semibold rounded-xl"
                    size="lg"
                    disabled={!product.availability}
                    onClick={handleAddToCart}
                  >
                    <ShoppingCart className="mr-3 h-6 w-6" />
                    {product.availability ? 'Add to Cart' : 'Out of Stock'}
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Related Products Scroll Section - Full Width */}
        <RelatedProducts 
          products={products}
          currentProductId={product.id}
          countryCode={countryCode}
        />

        {/* Detailed Information Tabs */}
        <section className="container mx-auto px-4 py-12 lg:py-20">
          <Tabs defaultValue="medical" className="w-full">
            <TabsList className="w-full max-w-3xl mx-auto mb-8 bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10 p-1 rounded-xl h-auto flex-wrap">
              <TabsTrigger value="medical" className="flex-1 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Stethoscope className="h-4 w-4 mr-2" />
                Medical Info
              </TabsTrigger>
              <TabsTrigger value="overview" className="flex-1 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Overview
              </TabsTrigger>
              <TabsTrigger value="effects" className="flex-1 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Effects
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex-1 py-3 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Usage Guide
              </TabsTrigger>
            </TabsList>

            {/* Medical Information Tab - AI Enhanced */}
            <TabsContent value="medical" className="space-y-8">
              {isMedicalLoading ? (
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="p-6 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10 space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <div className="flex gap-2 flex-wrap">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-8 w-28" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10 space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
              ) : medicalInfo ? (
                <div className="space-y-8">
                  {/* Conditions & Effects Row */}
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Medical Conditions */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20"
                    >
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Stethoscope className="h-5 w-5" />
                        May Help With
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {medicalInfo.medicalConditions.map((condition) => (
                          <Badge
                            key={condition}
                            className="px-3 py-1.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/30"
                          >
                            {condition}
                          </Badge>
                        ))}
                      </div>
                    </motion.div>

                    {/* Therapeutic Effects */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20"
                    >
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                        <Heart className="h-5 w-5" />
                        Therapeutic Effects
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {medicalInfo.therapeuticEffects.map((effect) => (
                          <Badge
                            key={effect}
                            className="px-3 py-1.5 bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-400/30"
                          >
                            {effect}
                          </Badge>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  {/* Recommended For & Time of Use */}
                  <div className="grid md:grid-cols-3 gap-6">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold">Recommended For</h4>
                      </div>
                      <ul className="space-y-2">
                        {medicalInfo.recommendedFor.slice(0, 3).map((rec) => (
                          <li key={rec} className="text-sm text-muted-foreground flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Timer className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold">Best Time to Use</h4>
                      </div>
                      <p className="text-muted-foreground text-sm">{medicalInfo.timeOfUse}</p>
                      <p className="text-xs text-muted-foreground/70 mt-2">{medicalInfo.onsetDuration}</p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Pill className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold">Dosage Guidance</h4>
                      </div>
                      <p className="text-muted-foreground text-sm">{medicalInfo.dosageGuidance}</p>
                    </motion.div>
                  </div>

                  {/* Warnings & Research */}
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Side Effects & Warnings */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20"
                    >
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-5 w-5" />
                        Potential Side Effects
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {medicalInfo.potentialSideEffects.map((effect) => (
                          <Badge
                            key={effect}
                            variant="outline"
                            className="px-3 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-400/30"
                          >
                            {effect}
                          </Badge>
                        ))}
                      </div>
                      {medicalInfo.interactionWarnings.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-amber-500/20">
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">Drug Interactions:</p>
                          <ul className="space-y-1">
                            {medicalInfo.interactionWarnings.slice(0, 3).map((warning) => (
                              <li key={warning} className="text-xs text-amber-600/80 dark:text-amber-200/70 flex items-start gap-2">
                                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                {warning}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>

                    {/* Research Notes */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="p-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/30 border border-border/50 dark:border-white/10"
                    >
                      <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground">
                        <BookOpen className="h-5 w-5 text-primary" />
                        Research & Evidence
                      </h3>
                      <div className="prose prose-sm max-w-none">
                        <p className="text-muted-foreground leading-relaxed">
                          {medicalInfo.researchNotes}
                        </p>
                      </div>
                      <div className="mt-6 pt-4 border-t border-border/50 dark:border-white/10">
                        <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          Patient Experiences:
                        </p>
                        <blockquote className="pl-4 border-l-2 border-primary/40 italic text-sm text-muted-foreground">
                          {medicalInfo.patientTestimonialSummary}
                        </blockquote>
                      </div>
                    </motion.div>
                  </div>

                  {/* Medical Disclaimer */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-4 rounded-xl bg-primary/10 border border-primary/20"
                  >
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">Medical Disclaimer:</span> This information is for educational purposes only and should not replace professional medical advice. Always consult with your prescribing physician before starting or modifying any cannabis therapy.
                      </p>
                    </div>
                  </motion.div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Medical information unavailable</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="overview" className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Category Info */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10"
                >
                  <h3 className={`text-xl font-bold mb-3 ${styles.accent}`}>
                    {currentCategoryInfo.title}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {currentCategoryInfo.description}
                  </p>
                  <div className="space-y-2">
                    {currentCategoryInfo.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span className="text-sm">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Flavor Profile */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-6 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10"
                >
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Beaker className="h-5 w-5 text-primary" />
                    Terpene & Flavor Profile
                  </h3>
                  {product.terpenes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {product.terpenes.map((terpene) => (
                        <Badge
                          key={terpene}
                          variant="outline"
                          className="px-4 py-2 text-sm bg-background/30 border-white/15"
                        >
                          {terpene}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Terpene profile information coming soon.</p>
                  )}
                </motion.div>
              </div>
            </TabsContent>

            <TabsContent value="effects" className="space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Effects */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10"
                >
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Wind className="h-5 w-5 text-primary" />
                    Expected Effects
                  </h3>
                  {product.effects.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {product.effects.map((effect) => (
                        <div
                          key={effect}
                          className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10"
                        >
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="text-sm font-medium">{effect}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Effects information coming soon.</p>
                  )}
                </motion.div>

                {/* Medical Benefits */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-6 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10"
                >
                  <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Heart className="h-5 w-5 text-primary" />
                    Therapeutic Benefits
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 dark:bg-white/5">
                      <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <div>
                        <p className="font-medium">Medical Grade</p>
                        <p className="text-sm text-muted-foreground">Cultivated under strict medical standards</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 dark:bg-white/5">
                      <CheckCircle2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400 mt-0.5" />
                      <div>
                        <p className="font-medium">Lab Tested</p>
                        <p className="text-sm text-muted-foreground">Verified cannabinoid content and purity</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 dark:bg-white/5">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-medium">Consistent Quality</p>
                        <p className="text-sm text-muted-foreground">Batch-to-batch consistency guaranteed</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </TabsContent>

            <TabsContent value="usage" className="space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-3xl mx-auto"
              >
                <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-8">
                  <div className="flex items-start gap-3">
                    <Info className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-amber-700 dark:text-amber-300 mb-2">Medical Disclaimer</h3>
                      <p className="text-amber-700/80 dark:text-amber-200/80 text-sm">
                        This product is intended for medical use only. Always consult with your healthcare provider before starting any cannabis therapy. Dosage should be determined by your prescribing physician based on your individual needs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10 text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-primary">1</span>
                    </div>
                    <h4 className="font-semibold mb-2">Start Low</h4>
                    <p className="text-sm text-muted-foreground">Begin with a small dose and wait to feel effects before increasing.</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10 text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-primary">2</span>
                    </div>
                    <h4 className="font-semibold mb-2">Go Slow</h4>
                    <p className="text-sm text-muted-foreground">Wait at least 2 hours between doses to properly gauge effects.</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10 text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl font-bold text-primary">3</span>
                    </div>
                    <h4 className="font-semibold mb-2">Track Progress</h4>
                    <p className="text-sm text-muted-foreground">Use the patient portal to log dosage and effects for optimal care.</p>
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </Tabs>
        </section>
      </main>

      {/* Floating Cart Button */}
      <FloatingCartButton />
      
      {/* Cart Sheet */}
      <Cart />

      <Footer />
    </PageTransition>
  );
}
