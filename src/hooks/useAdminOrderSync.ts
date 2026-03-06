/**
 * Admin Order Sync Hook
 * 
 * Provides admin-level order management and sync operations
 * for synchronizing local orders with the Dr. Green API.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDrGreenApi } from "@/hooks/useDrGreenApi";
import { useToast } from "@/hooks/use-toast";

export type SyncStatus = "pending" | "synced" | "failed" | "manual_review";
export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface OrderItem {
  // Support both naming conventions (DB stores snake_case, API expects camelCase)
  strainId?: string;
  strain_id?: string;
  strainName?: string;
  strain_name?: string;
  quantity: number;
  unitPrice?: number;
  unit_price?: number;
  totalPrice?: number;
}

interface ShippingAddress {
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  countryCode: string;
}

export interface LocalOrder {
  id: string;
  user_id: string;
  drgreen_order_id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  items: OrderItem[];
  sync_status: SyncStatus;
  synced_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
  // Order context captured at checkout (for reliable sync)
  client_id?: string | null;
  shipping_address?: ShippingAddress | null;
  customer_email?: string | null;
  customer_name?: string | null;
  country_code?: string | null;
  currency?: string | null;
}

export interface OrderFilters {
  syncStatus?: SyncStatus | "all";
  status?: OrderStatus | "all";
  paymentStatus?: PaymentStatus | "all";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface OrderSyncResult {
  success: boolean;
  orderId: string;
  drGreenOrderId?: string;
  error?: string;
}

export interface OrderStats {
  total: number;
  pending: number;
  synced: number;
  failed: number;
  today: number;
}

export function useAdminOrderSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { createOrder } = useDrGreenApi();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Fetch all orders with admin privileges
  const fetchAllOrders = useCallback(async (filters: OrderFilters = {}): Promise<{
    orders: LocalOrder[];
    total: number;
  }> => {
    const {
      syncStatus = "all",
      status = "all",
      paymentStatus = "all",
      search = "",
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 20,
    } = filters;

    let query = supabase
      .from("drgreen_orders")
      .select("*", { count: "exact" });

    // Apply filters
    if (syncStatus !== "all") {
      query = query.eq("sync_status", syncStatus);
    }

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (paymentStatus !== "all") {
      query = query.eq("payment_status", paymentStatus);
    }

    if (dateFrom) {
      query = query.gte("created_at", dateFrom);
    }

    if (dateTo) {
      query = query.lte("created_at", dateTo);
    }

    if (search) {
      query = query.or(`drgreen_order_id.ilike.%${search}%,drgreen_clients.email.ilike.%${search}%`);
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to).order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) throw error;

    // Map orders - use order-stored context if available, fallback to client lookup
    const orders: LocalOrder[] = await Promise.all(
      (data || []).map(async (order: any) => {
        // Prioritize order-stored data (captured at checkout)
        const hasStoredContext = order.client_id && order.shipping_address;
        
        if (hasStoredContext) {
          // Use order-stored context - no client lookup needed
          return {
            ...order,
            items: order.items || [],
            shipping_address: order.shipping_address as ShippingAddress | null,
          };
        }
        
        // Fallback: fetch from client record (for legacy orders without stored context)
        const { data: client } = await supabase
          .from("drgreen_clients")
          .select("email, full_name, drgreen_client_id, shipping_address")
          .eq("user_id", order.user_id)
          .maybeSingle();

        return {
          ...order,
          items: order.items || [],
          customer_email: order.customer_email || client?.email,
          customer_name: order.customer_name || client?.full_name,
          client_id: order.client_id || client?.drgreen_client_id,
          shipping_address: (order.shipping_address || client?.shipping_address) as ShippingAddress | null,
        };
      })
    );

    return { orders, total: count || 0 };
  }, []);

  // Query for orders
  const ordersQuery = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => fetchAllOrders(),
    staleTime: 30000, // 30 seconds
  });

  // Query for order stats
  const statsQuery = useQuery({
    queryKey: ["admin-order-stats"],
    queryFn: async (): Promise<OrderStats> => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalRes, pendingRes, syncedRes, failedRes, todayRes] = await Promise.all([
        supabase.from("drgreen_orders").select("id", { count: "exact", head: true }),
        supabase.from("drgreen_orders").select("id", { count: "exact", head: true }).eq("sync_status", "pending"),
        supabase.from("drgreen_orders").select("id", { count: "exact", head: true }).eq("sync_status", "synced"),
        supabase.from("drgreen_orders").select("id", { count: "exact", head: true }).eq("sync_status", "failed"),
        supabase.from("drgreen_orders").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
      ]);

      return {
        total: totalRes.count || 0,
        pending: pendingRes.count || 0,
        synced: syncedRes.count || 0,
        failed: failedRes.count || 0,
        today: todayRes.count || 0,
      };
    },
    staleTime: 30000,
  });

  // Sync a single order to Dr. Green API
  const syncOrderMutation = useMutation({
    mutationFn: async (orderId: string): Promise<OrderSyncResult> => {
      // Get the order first
      const { data: order, error: orderError } = await supabase
        .from("drgreen_orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (orderError || !order) {
        throw new Error(orderError?.message || "Order not found");
      }

      // Prioritize order-stored data for reliable sync (captures checkout context)
      let clientId = order.client_id as string | null;
      let shippingAddress = order.shipping_address as unknown as ShippingAddress | null;
      
      // Fallback to client lookup only if order doesn't have stored context
      if (!clientId || !shippingAddress) {
        const { data: client, error: clientError } = await supabase
          .from("drgreen_clients")
          .select("drgreen_client_id, shipping_address")
          .eq("user_id", order.user_id)
          .maybeSingle();

        if (clientError || !client) {
          throw new Error(clientError?.message || "Client not found for this order");
        }

        clientId = clientId || client.drgreen_client_id;
        shippingAddress = shippingAddress || (client.shipping_address as unknown as ShippingAddress | null);
      }

      if (!clientId) {
        throw new Error("Client ID not found for this order");
      }

      if (!shippingAddress) {
        throw new Error("Shipping address not found for this order");
      }

      // Format items for Dr. Green API (handle both snake_case from DB and camelCase)
      const orderItems = order.items as unknown as OrderItem[];
      const items = (orderItems || []).map((item) => ({
        productId: item.strain_id || item.strainId || '',
        quantity: item.quantity,
        price: item.unit_price || item.unitPrice || 0,
      }));

      // Create order in Dr. Green API using order-stored address
      const result = await createOrder({
        clientId,
        items,
        shippingAddress: {
          address1: shippingAddress.address1,
          address2: shippingAddress.address2 || '',
          city: shippingAddress.city,
          state: shippingAddress.state || shippingAddress.city,
          postalCode: shippingAddress.postalCode,
          country: shippingAddress.country,
          countryCode: shippingAddress.countryCode,
        },
      });

      if (result.error || !result.data) {
        // Update local order with failure
        await supabase
          .from("drgreen_orders")
          .update({
            sync_status: "failed",
            sync_error: result.error || "Unknown error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        return {
          success: false,
          orderId,
          error: result.error || "Failed to sync order",
        };
      }

      // Update local order with success
      await supabase
        .from("drgreen_orders")
        .update({
          drgreen_order_id: result.data.orderId || order.drgreen_order_id,
          sync_status: "synced",
          synced_at: new Date().toISOString(),
          sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      return {
        success: true,
        orderId,
        drGreenOrderId: result.data.orderId,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] });

      if (result.success) {
        toast({
          title: "Order synced",
          description: `Order successfully synced to Dr. Green API.`,
        });
      } else {
        toast({
          title: "Sync failed",
          description: result.error,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Sync error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Batch sync multiple orders
  const batchSyncMutation = useMutation({
    mutationFn: async (orderIds: string[]): Promise<OrderSyncResult[]> => {
      const results: OrderSyncResult[] = [];

      for (const orderId of orderIds) {
        try {
          const result = await syncOrderMutation.mutateAsync(orderId);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            orderId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      toast({
        title: "Batch sync complete",
        description: `${successful} synced, ${failed} failed.`,
        variant: failed > 0 ? "destructive" : "default",
      });
    },
  });

  // Update local order status
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({
      orderId,
      status,
      paymentStatus,
    }: {
      orderId: string;
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
    }) => {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (status) updates.status = status;
      if (paymentStatus) updates.payment_status = paymentStatus;

      const { error } = await supabase
        .from("drgreen_orders")
        .update(updates)
        .eq("id", orderId);

      if (error) throw error;

      // Auto-trigger dispatch email when status changes to SHIPPED
      if (status === "SHIPPED") {
        try {
          const { data: order } = await supabase
            .from("drgreen_orders")
            .select("*")
            .eq("id", orderId)
            .maybeSingle();

          if (order && order.customer_email) {
            const items = (order.items as unknown as OrderItem[]) || [];
            const shippingAddr = order.shipping_address as unknown as ShippingAddress | null;

            await supabase.functions.invoke("send-dispatch-email", {
              body: {
                email: order.customer_email,
                customerName: order.customer_name || "Customer",
                orderId: order.drgreen_order_id || orderId,
                items: items.map((item) => ({
                  strain_name: item.strain_name || item.strainName || "Product",
                  quantity: item.quantity,
                  unit_price: item.unit_price || item.unitPrice || 0,
                })),
                totalAmount: order.total_amount || 0,
                currency: order.currency || "EUR",
                shippingAddress: shippingAddr || {
                  address1: "Address on file",
                  city: "—",
                  postalCode: "—",
                  country: "—",
                },
                region: order.country_code || undefined,
                clientId: order.client_id || undefined,
              },
            });
            console.log("[AdminOrderSync] Dispatch email sent for order:", orderId);
          } else {
            console.warn("[AdminOrderSync] No customer email for dispatch notification, order:", orderId);
          }
        } catch (emailErr) {
          // Non-blocking: log but don't fail the status update
          console.error("[AdminOrderSync] Failed to send dispatch email:", emailErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({
        title: "Order updated",
        description: "Order status has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Flag order for manual review
  const flagForReviewMutation = useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("drgreen_orders")
        .update({
          sync_status: "manual_review",
          sync_error: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] });
      toast({
        title: "Order flagged",
        description: "Order has been flagged for manual review.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Flag failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset sync status to pending
  const resetSyncStatusMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("drgreen_orders")
        .update({
          sync_status: "pending",
          sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] });
      toast({
        title: "Status reset",
        description: "Order sync status has been reset to pending.",
      });
    },
  });

  // Process a pending order: mark as CONFIRMED + PAID
  const processOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("drgreen_orders")
        .update({
          status: "CONFIRMED",
          payment_status: "PAID",
          sync_status: "manual_review",
          sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] });
      toast({
        title: "Order processed",
        description: "Order confirmed and marked as paid.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Process failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Batch process all pending orders
  const batchProcessMutation = useMutation({
    mutationFn: async () => {
      const { data, error: fetchError } = await supabase
        .from("drgreen_orders")
        .select("id")
        .eq("sync_status", "pending")
        .eq("status", "PENDING");

      if (fetchError) throw fetchError;
      if (!data || data.length === 0) throw new Error("No pending orders to process");

      const { error } = await supabase
        .from("drgreen_orders")
        .update({
          status: "CONFIRMED",
          payment_status: "PAID",
          sync_status: "manual_review",
          sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("sync_status", "pending")
        .eq("status", "PENDING");

      if (error) throw error;
      return data.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] });
      toast({
        title: "Batch process complete",
        description: `${count} orders confirmed and marked as paid.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Batch process failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    // Queries
    orders: ordersQuery.data?.orders || [],
    totalOrders: ordersQuery.data?.total || 0,
    stats: statsQuery.data,
    isLoading: ordersQuery.isLoading,
    isLoadingStats: statsQuery.isLoading,
    error: ordersQuery.error,

    // Actions
    fetchOrders: async (filters: OrderFilters) => {
      const result = await fetchAllOrders(filters);
      return result;
    },
    syncOrder: syncOrderMutation.mutateAsync,
    batchSyncOrders: batchSyncMutation.mutateAsync,
    updateOrderStatus: updateOrderStatusMutation.mutateAsync,
    flagForReview: flagForReviewMutation.mutateAsync,
    resetSyncStatus: resetSyncStatusMutation.mutateAsync,
    processOrder: processOrderMutation.mutateAsync,
    batchProcessPending: batchProcessMutation.mutateAsync,

    // Mutation states
    isSyncing: syncOrderMutation.isPending,
    isBatchSyncing: batchSyncMutation.isPending,
    isUpdating: updateOrderStatusMutation.isPending,
    isProcessing: processOrderMutation.isPending || batchProcessMutation.isPending,

    // Selection
    selectedOrders,
    setSelectedOrders,
    toggleOrderSelection: (orderId: string) => {
      setSelectedOrders((prev) =>
        prev.includes(orderId)
          ? prev.filter((id) => id !== orderId)
          : [...prev, orderId]
      );
    },
    selectAllOrders: (orderIds: string[]) => setSelectedOrders(orderIds),
    clearSelection: () => setSelectedOrders([]),

    // Refetch
    refetch: () => {
      ordersQuery.refetch();
      statsQuery.refetch();
    },
  };
}
