/**
 * Centralized API endpoint configuration.
 * 
 * All proxy action strings live here — no scattered magic strings.
 */

export const API_CONFIG = {
  drgreen: {
    /** Edge function name for all Dr. Green API calls */
    proxy: 'drgreen-proxy',
    
    /** Action strings passed to the proxy */
    actions: {
      // Client operations
      createClient: 'create-client-legacy',
      getClient: 'get-client',
      getClientByAuthEmail: 'get-client-by-auth-email',
      getMyDetails: 'get-my-details',
      patchClient: 'patch-client',
      deleteClient: 'delete-client',
      activateClient: 'activate-client',
      deactivateClient: 'deactivate-client',
      bulkDeleteClients: 'bulk-delete-clients',
      updateShippingAddress: 'update-shipping-address',
      adminUpdateShippingAddress: 'admin-update-shipping-address',
      syncClientStatus: 'sync-client-status',
      
      // Strain/product operations
      getStrains: 'get-strains-legacy',
      getStrain: 'get-strain',
      
      // Cart operations
      getCart: 'get-cart-legacy',
      addToCart: 'add-to-cart',
      removeFromCart: 'remove-from-cart',
      emptyCart: 'empty-cart',
      
      // Order operations
      createOrder: 'create-order',
      getOrder: 'get-order',
      getOrders: 'get-orders',
      placeOrder: 'place-order',
      updateOrder: 'update-order',
      createPayment: 'create-payment',
      getPayment: 'get-payment',
      
      // Admin / DApp operations
      dappClients: 'dapp-clients',
      dappClientDetails: 'dapp-client-details',
      dappVerifyClient: 'dapp-verify-client',
      dappOrders: 'dapp-orders',
      dappOrderDetails: 'dapp-order-details',
      dappUpdateOrder: 'dapp-update-order',
      dappStrains: 'dapp-strains',
      
      // Dashboard
      dashboardSummary: 'dashboard-summary',
      dashboardAnalytics: 'dashboard-analytics',
      salesSummary: 'sales-summary',
      clientsSummary: 'clients-summary',
      
      // User
      getUserMe: 'get-user-me',
    },
  },
} as const;

/** Shorthand for accessing action strings */
export const ACTIONS = API_CONFIG.drgreen.actions;
export const PROXY_FN = API_CONFIG.drgreen.proxy;
