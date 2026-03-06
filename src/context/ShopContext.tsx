import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PriceTruth } from '@/lib/commerce';
import { PROXY_FN, ACTIONS } from '@/config/endpoints';

interface CartItem {
  id: string;
  strain_id: string;
  strain_name: string;
  quantity: number;
  unit_price: number; // Fixed/local price from Dr Green API (already in correct currency)
}

interface DrGreenClient {
  id: string;
  user_id: string;
  drgreen_client_id: string;
  country_code: string;
  is_kyc_verified: boolean;
  admin_approval: string;
  kyc_link: string | null;
  email?: string | null;
  full_name?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  shipping_address?: any;
}

interface ShopContextType {
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (item: Omit<CartItem, 'id'>) => Promise<void>;
  removeFromCart: (strainId: string) => Promise<void>;
  updateQuantity: (strainId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  drGreenClient: DrGreenClient | null;
  isEligible: boolean;
  isLoading: boolean;
  refreshClient: () => Promise<void>;
  syncVerificationFromDrGreen: () => Promise<boolean>;
  isSyncing: boolean;
  countryCode: string;
  setCountryCode: (code: string) => void;
}

const ShopContext = createContext<ShopContextType | undefined>(undefined);

// Get country code from domain (URL-first strategy)
function getCountryFromDomain(): string {
  const hostname = window.location.hostname.toLowerCase();
  
  // Lovable preview URLs and .co.za domains → South Africa
  if (hostname.includes('lovable.app') || hostname.includes('lovableproject.com') || hostname.endsWith('.co.za')) {
    return 'ZA';
  }
  // Portugal domains
  if (hostname.endsWith('.pt') || hostname.includes('healingbuds.pt')) {
    return 'PT';
  }
  // UK domains
  if (hostname.endsWith('.co.uk') || hostname.includes('healingbuds.co.uk')) {
    return 'GB';
  }
  // Thailand domains
  if (hostname.endsWith('.co.th') || hostname.endsWith('.th')) {
    return 'TH';
  }
  // Global domains → South Africa (operational region)
  if (hostname.endsWith('.global') || hostname.includes('healingbuds.global')) {
    return 'ZA';
  }
  // Global/fallback to South Africa
  return 'ZA';
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [drGreenClient, setDrGreenClient] = useState<DrGreenClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  // Country is determined by URL domain, not geolocation
  const [countryCode, setCountryCode] = useState<string>(() => getCountryFromDomain());
  const { toast } = useToast();


  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  
  
  const isEligible = drGreenClient?.is_kyc_verified === true && drGreenClient?.admin_approval === 'VERIFIED';

  const fetchCart = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCart([]);
      return;
    }

    const { data, error } = await supabase
      .from('drgreen_cart')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching cart:', error);
      return;
    }

    setCart(data || []);
  }, []);

  // Attempt to auto-discover and link existing Dr. Green client by email
  const linkClientFromDrGreenByAuthEmail = useCallback(async (userId: string, silent = false): Promise<boolean> => {
    try {
      console.log('[ShopContext] Attempting auto-discovery of Dr. Green client...');
      
      // Show toast to user (unless silent mode for auto-login)
      if (!silent) {
        toast({
          title: 'Checking records...',
          description: 'Looking up your profile in our system',
        });
      }
      
      const { data, error } = await supabase.functions.invoke(PROXY_FN, {
        body: { action: ACTIONS.getClientByAuthEmail },
      });
      
      if (error) {
        console.error('[ShopContext] Auto-discovery API error:', error);
        if (!silent) {
          toast({
            title: 'Lookup Failed',
            description: 'Could not verify your profile. Please try again later.',
            variant: 'destructive',
          });
        }
        return false;
      }
      
      if (data?.found && data?.clientId) {
        console.log('[ShopContext] Found existing Dr. Green client, linking...');
        
        // Upsert the local mapping
        const { error: upsertError } = await supabase
          .from('drgreen_clients')
          .upsert({
            user_id: userId,
            drgreen_client_id: data.clientId,
            is_kyc_verified: data.isKYCVerified ?? false,
            admin_approval: data.adminApproval || 'PENDING',
            kyc_link: data.kycLink || null,
            email: data.email || null,
            full_name: data.firstName && data.lastName 
              ? `${data.firstName} ${data.lastName}`.trim() 
              : null,
            country_code: data.countryCode || 'PT',
          }, {
            onConflict: 'user_id',
          });
        
        if (upsertError) {
          console.error('[ShopContext] Failed to upsert client mapping:', upsertError);
          if (!silent) {
            toast({
              title: 'Sync Error',
              description: 'Could not save profile data locally.',
              variant: 'destructive',
            });
          }
          return false;
        }
        
        const statusMsg = data.adminApproval === 'VERIFIED' && data.isKYCVerified
          ? 'You are verified and ready to shop!'
          : data.adminApproval === 'PENDING'
          ? 'Profile found - awaiting verification'
          : 'Profile found - status: ' + data.adminApproval;
        
        if (!silent) {
          toast({
            title: 'Profile Found!',
            description: statusMsg,
          });
        }
        
        console.log('[ShopContext] Successfully linked Dr. Green client:', data.clientId);
        return true;
      } else {
        console.log('[ShopContext] No existing Dr. Green client found for this email');
        if (!silent) {
          toast({
            title: 'No Profile Found',
            description: 'Please complete registration to access the dispensary.',
          });
        }
        return false;
      }
    } catch (err) {
      console.error('[ShopContext] Auto-discovery error:', err);
      if (!silent) {
        toast({
          title: 'Connection Error',
          description: 'Please check your connection and try again.',
          variant: 'destructive',
        });
      }
      return false;
    }
  }, [toast]);

  // Background: fetch live status from Dr. Green API and update state + cache
  const fetchLiveStatusInBackground = useCallback((localRecord: DrGreenClient, userId: string) => {
    if (!localRecord.drgreen_client_id || localRecord.drgreen_client_id.startsWith('local-')) return;

    console.log('[ShopContext] Background: fetching live status from Dr. Green API...');
    supabase.functions.invoke(PROXY_FN, {
      body: {
        action: ACTIONS.getClient,
        clientId: localRecord.drgreen_client_id,
      },
    }).then(({ data: apiResponse, error: apiError }) => {
      const liveData = apiResponse?.data || apiResponse;
      if (!apiError && liveData && (liveData.isKYCVerified !== undefined || liveData.adminApproval !== undefined)) {
        const liveKyc = liveData.isKYCVerified ?? liveData.is_kyc_verified ?? false;
        const liveApproval = liveData.adminApproval ?? liveData.admin_approval ?? 'PENDING';
        const liveKycLink = liveData.kycLink ?? liveData.kyc_link ?? null;

        // Update React state with live data
        setDrGreenClient(prev => prev ? {
          ...prev,
          is_kyc_verified: liveKyc,
          admin_approval: liveApproval,
          kyc_link: liveKycLink,
        } : prev);

        // Update local cache if changed (fire-and-forget)
        if (
          localRecord.is_kyc_verified !== liveKyc ||
          localRecord.admin_approval !== liveApproval ||
          localRecord.kyc_link !== liveKycLink
        ) {
          console.log('[ShopContext] Background: status changed, updating cache...');
          supabase
            .from('drgreen_clients')
            .update({
              is_kyc_verified: liveKyc,
              admin_approval: liveApproval,
              kyc_link: liveKycLink,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .then(({ error: updateErr }) => {
              if (updateErr) console.error('[ShopContext] Cache update error:', updateErr);
            });
        }
      } else {
        console.warn('[ShopContext] Background: could not fetch live status');
      }
    }).catch(err => {
      console.warn('[ShopContext] Background: API call failed:', err);
    });
  }, []);

  const fetchClient = useCallback(async () => {
    // Use getSession first - it's synchronous from cache and avoids race conditions
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Handle stale/invalid sessions gracefully
    if (sessionError || !session?.user) {
      if (sessionError) {
        console.warn('[ShopContext] Session error (stale token?), clearing state:', sessionError.message);
      }
      setDrGreenClient(null);
      setIsLoading(false);
      return;
    }
    const user = session.user;

    // Step 1: Check local mapping (fast DB query)
    const { data: localRecord, error } = await supabase
      .from('drgreen_clients')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching client mapping:', error);
      // If it's an auth error (stale token), clear state
      if (error.message?.includes('JWT') || error.code === 'PGRST301') {
        setDrGreenClient(null);
        setIsLoading(false);
        return;
      }
    }

    // Step 2: If local record exists → set state immediately, then background-sync
    if (localRecord) {
      setDrGreenClient(localRecord);
      setIsLoading(false); // ← Login unblocked here
      // Fire-and-forget: update from live API in background
      fetchLiveStatusInBackground(localRecord, user.id);
      return;
    }

    // Step 3: No local mapping → set loading false immediately, run discovery in background
    console.log('[ShopContext] No local client mapping, running auto-discovery in background...');
    setDrGreenClient(null);
    setIsLoading(false); // ← Login unblocked here too

    // Background auto-discovery
    linkClientFromDrGreenByAuthEmail(user.id, true).then(linked => {
      if (linked) {
        supabase
          .from('drgreen_clients')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
          .then(({ data: newRecord }) => {
            if (newRecord) {
              setDrGreenClient(newRecord);
            }
          });
      }
    });
  }, [linkClientFromDrGreenByAuthEmail, fetchLiveStatusInBackground]);

  const refreshClient = useCallback(async () => {
    await fetchClient();
  }, [fetchClient]);

  // Sync verification status from Dr Green API
  // Now simply re-fetches client which always calls API directly
  const syncVerificationFromDrGreen = useCallback(async (): Promise<boolean> => {
    if (!drGreenClient?.drgreen_client_id) return false;
    if (drGreenClient.drgreen_client_id.startsWith('local-')) return false;
    
    setIsSyncing(true);
    try {
      await fetchClient();
      return true;
    } catch (err) {
      console.error('Sync verification error:', err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [drGreenClient?.drgreen_client_id, fetchClient]);

  useEffect(() => {
    fetchCart();
    fetchClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Defer to avoid auth lock contention (Supabase known deadlock pattern)
      setTimeout(() => {
        // On SIGNED_OUT or stale token, clear state immediately
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          if (event === 'SIGNED_OUT') {
            setDrGreenClient(null);
            setCart([]);
            return;
          }
        }
        fetchCart();
        fetchClient();
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, [fetchCart, fetchClient]);

  // Live sync: poll for verification status updates every 60 seconds
  // Stops polling once the patient is fully verified to reduce API load
  useEffect(() => {
    if (!drGreenClient?.drgreen_client_id) return;
    if (drGreenClient.drgreen_client_id.startsWith('local-')) return;
    if (drGreenClient.is_kyc_verified && drGreenClient.admin_approval === 'VERIFIED') return;

    const interval = setInterval(() => {
      console.log('[ShopContext] Polling live verification status...');
      fetchClient();
    }, 60000);

    return () => clearInterval(interval);
  }, [drGreenClient?.drgreen_client_id, drGreenClient?.is_kyc_verified, drGreenClient?.admin_approval, fetchClient]);

  const addToCart = async (item: Omit<CartItem, 'id'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to add items to your cart.",
        variant: "destructive",
      });
      return;
    }

    // Override price with truth cache to prevent stale pricing
    const truthPrice = PriceTruth.getPrice(item.strain_id);
    const finalPrice = truthPrice > 0 ? truthPrice : item.unit_price;

    const { error } = await supabase
      .from('drgreen_cart')
      .upsert({
        user_id: user.id,
        strain_id: item.strain_id,
        strain_name: item.strain_name,
        quantity: item.quantity,
        unit_price: finalPrice,
      }, {
        onConflict: 'user_id,strain_id',
      });

    if (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: "Error",
        description: "Failed to add item to cart.",
        variant: "destructive",
      });
      return;
    }

    await fetchCart();
    toast({
      title: "Added to cart",
      description: `${item.strain_name} added to your cart.`,
    });
  };

  const removeFromCart = async (strainId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('drgreen_cart')
      .delete()
      .eq('user_id', user.id)
      .eq('strain_id', strainId);

    if (error) {
      console.error('Error removing from cart:', error);
      return;
    }

    await fetchCart();
  };

  const updateQuantity = async (strainId: string, quantity: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (quantity <= 0) {
      await removeFromCart(strainId);
      return;
    }

    const { error } = await supabase
      .from('drgreen_cart')
      .update({ quantity })
      .eq('user_id', user.id)
      .eq('strain_id', strainId);

    if (error) {
      console.error('Error updating quantity:', error);
      return;
    }

    await fetchCart();
  };

  const clearCart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('drgreen_cart')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error clearing cart:', error);
      return;
    }

    setCart([]);
  };

  return (
    <ShopContext.Provider
      value={{
        cart,
        cartCount,
        cartTotal,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        drGreenClient,
        isEligible,
        isLoading,
        refreshClient,
        syncVerificationFromDrGreen,
        isSyncing,
        countryCode,
        setCountryCode,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const context = useContext(ShopContext);
  if (context === undefined) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
