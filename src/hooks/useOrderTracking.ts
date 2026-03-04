import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useShop } from '@/context/ShopContext';
import { useDrGreenApi } from '@/hooks/useDrGreenApi';

interface OrderItem {
  strain_id: string;
  strain_name: string;
  quantity: number;
  unit_price: number;
}

interface ShippingAddressSnapshot {
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  countryCode: string;
}

interface LocalOrder {
  id: string;
  user_id: string;
  drgreen_order_id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
  client_id?: string | null;
  shipping_address?: ShippingAddressSnapshot | null;
  customer_email?: string | null;
  customer_name?: string | null;
  country_code?: string | null;
  currency?: string | null;
}

export interface SaveOrderParams {
  drgreen_order_id: string;
  status: string;
  payment_status: string;
  total_amount: number;
  items: OrderItem[];
  client_id?: string;
  shipping_address?: ShippingAddressSnapshot;
  customer_email?: string;
  customer_name?: string;
  country_code?: string;
  currency?: string;
  sync_error?: string;
  sync_status?: string;
}

const SYNC_INTERVAL_MS = 60_000;

export function useOrderTracking() {
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const { toast } = useToast();
  const { addToCart, drGreenClient } = useShop();
  const { getOrders: getLiveOrders } = useDrGreenApi();
  const syncInProgress = useRef(false);

  // Fetch local orders from Supabase
  const fetchLocalOrders = useCallback(async (): Promise<LocalOrder[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setOrders([]);
      setIsLoading(false);
      return [];
    }

    const { data, error } = await supabase
      .from('drgreen_orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      setIsLoading(false);
      return [];
    }

    const mapped = (data || []).map(order => ({
      ...order,
      items: (order.items as unknown as OrderItem[]) || [],
      shipping_address: order.shipping_address as unknown as ShippingAddressSnapshot | null,
    }));
    setOrders(mapped);
    setIsLoading(false);
    return mapped;
  }, []);

  // Sync live order statuses from Dr. Green DApp API
  const syncFromDrGreen = useCallback(async () => {
    const clientId = drGreenClient?.drgreen_client_id;
    if (!clientId || clientId.startsWith('local-')) return;
    if (syncInProgress.current) return;

    syncInProgress.current = true;
    setIsSyncing(true);

    try {
      const { data: liveOrders, error: apiError } = await getLiveOrders(clientId);

      if (apiError || !liveOrders) {
        console.warn('[OrderSync] Failed to fetch live orders:', apiError);
        return;
      }

      // Unwrap: API may return { success, data: [...] } or raw array or nested data.data
      let ordersList: any[] = [];
      if (Array.isArray(liveOrders)) {
        ordersList = liveOrders;
      } else if (typeof liveOrders === 'object' && liveOrders !== null) {
        const obj = liveOrders as any;
        if (Array.isArray(obj.data?.data)) {
          ordersList = obj.data.data;
        } else if (Array.isArray(obj.data)) {
          ordersList = obj.data;
        } else {
          console.warn('[OrderSync] Unexpected response shape:', JSON.stringify(liveOrders).slice(0, 300));
        }
      }

      if (ordersList.length === 0) {
        setLastSyncedAt(new Date());
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current local orders for comparison
      const { data: currentLocal } = await supabase
        .from('drgreen_orders')
        .select('*')
        .eq('user_id', user.id);

      const localMap = new Map(
        (currentLocal || []).map(o => [o.drgreen_order_id, o])
      );

      let changesDetected = 0;

      for (const live of ordersList) {
        const liveId = live.orderId || live.id;
        if (!liveId) continue;

        const local = localMap.get(liveId);
        const liveStatus = live.status || 'PENDING';
        const livePayment = live.paymentStatus || live.payment_status || 'PENDING';

        if (local) {
          // Compare and update if changed
          if (local.status !== liveStatus || local.payment_status !== livePayment) {
            const { error: updateErr } = await supabase
              .from('drgreen_orders')
              .update({
                status: liveStatus,
                payment_status: livePayment,
                synced_at: new Date().toISOString(),
                sync_status: 'synced',
              })
              .eq('id', local.id);

            if (!updateErr) {
              changesDetected++;
              toast({
                title: 'Order Status Updated',
                description: `Order #${liveId.slice(0, 8)}… is now ${liveStatus}`,
              });
            }
          }
        } else {
          // New order from DApp not in local DB — insert it
          const { error: insertErr } = await supabase
            .from('drgreen_orders')
            .insert({
              user_id: user.id,
              drgreen_order_id: liveId,
              status: liveStatus,
              payment_status: livePayment,
              total_amount: live.totalAmount || live.totalPrice || live.total_amount || 0,
              items: JSON.parse(JSON.stringify(live.items || [])),
              client_id: clientId,
              synced_at: new Date().toISOString(),
              sync_status: 'synced',
            });

          if (!insertErr) {
            changesDetected++;
          }
        }
      }

      // Refresh local orders if anything changed
      if (changesDetected > 0) {
        await fetchLocalOrders();
      }

      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('[OrderSync] Sync error:', err);
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, [drGreenClient?.drgreen_client_id, getLiveOrders, fetchLocalOrders, toast]);

  // Combined fetch: local first, then live sync only if user has a real Dr. Green client
  const fetchOrders = useCallback(async () => {
    await fetchLocalOrders();
    const clientId = drGreenClient?.drgreen_client_id;
    if (clientId && !clientId.startsWith('local-')) {
      syncFromDrGreen();
    }
  }, [fetchLocalOrders, syncFromDrGreen, drGreenClient?.drgreen_client_id]);

  // Manual refresh (returns promise so UI can await it)
  const refreshOrders = useCallback(async () => {
    await fetchLocalOrders();
    await syncFromDrGreen();
  }, [fetchLocalOrders, syncFromDrGreen]);

  // Set up realtime subscription for local DB changes + initial fetch
  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('order-status-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drgreen_orders' },
        (payload) => {
          const updatedOrder = payload.new as LocalOrder;
          const oldOrder = payload.old as LocalOrder;

          if (oldOrder.status !== updatedOrder.status) {
            toast({
              title: 'Order Status Updated',
              description: `Order #${updatedOrder.drgreen_order_id.slice(0, 8)}… is now ${updatedOrder.status}`,
            });
          }

          if (oldOrder.payment_status !== updatedOrder.payment_status) {
            toast({
              title: 'Payment Status Updated',
              description: `Payment for order #${updatedOrder.drgreen_order_id.slice(0, 8)}… is ${updatedOrder.payment_status}`,
            });
          }

          setOrders(prev =>
            prev.map(order =>
              order.id === updatedOrder.id
                ? { ...updatedOrder, items: (updatedOrder.items as unknown as OrderItem[]) || [] }
                : order
            )
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'drgreen_orders' },
        (payload) => {
          const newOrder = payload.new as LocalOrder;
          setOrders(prev => [{ ...newOrder, items: (newOrder.items as unknown as OrderItem[]) || [] }, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, toast]);

  // 60-second background polling for live sync
  useEffect(() => {
    const clientId = drGreenClient?.drgreen_client_id;
    if (!clientId || clientId.startsWith('local-')) return;

    const interval = setInterval(() => {
      console.log('[OrderSync] Background polling...');
      syncFromDrGreen();
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [drGreenClient?.drgreen_client_id, syncFromDrGreen]);

  // Reorder
  const reorder = async (order: LocalOrder) => {
    if (!order.items || order.items.length === 0) {
      toast({
        title: 'Cannot reorder',
        description: 'No items found in this order.',
        variant: 'destructive',
      });
      return;
    }

    try {
      for (const item of order.items) {
        await addToCart({
          strain_id: item.strain_id,
          strain_name: item.strain_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        });
      }

      toast({
        title: 'Items added to cart',
        description: `${order.items.length} item(s) from your previous order have been added to your cart.`,
      });
    } catch (error) {
      console.error('Error reordering:', error);
      toast({
        title: 'Reorder failed',
        description: 'Failed to add items to cart. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Save order locally
  const saveOrder = async (orderData: SaveOrderParams) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('drgreen_orders')
      .insert([{
        user_id: user.id,
        drgreen_order_id: orderData.drgreen_order_id,
        status: orderData.status,
        payment_status: orderData.payment_status,
        total_amount: orderData.total_amount,
        items: JSON.parse(JSON.stringify(orderData.items)),
        client_id: orderData.client_id,
        shipping_address: orderData.shipping_address ? JSON.parse(JSON.stringify(orderData.shipping_address)) : null,
        customer_email: orderData.customer_email,
        customer_name: orderData.customer_name,
        country_code: orderData.country_code,
        currency: orderData.currency,
        sync_error: orderData.sync_error || null,
        sync_status: orderData.sync_status || 'pending',
      }])
      .select()
      .single();

    if (error) {
      console.error('Error saving order:', error);
      return null;
    }

    return data;
  };

  // Update order status
  const updateOrderStatus = async (
    orderId: string,
    updates: { status?: string; payment_status?: string }
  ) => {
    const { error } = await supabase
      .from('drgreen_orders')
      .update(updates)
      .eq('drgreen_order_id', orderId);

    if (error) {
      console.error('Error updating order status:', error);
    }
  };

  return {
    orders,
    isLoading,
    isSyncing,
    lastSyncedAt,
    reorder,
    saveOrder,
    updateOrderStatus,
    refreshOrders,
  };
}
