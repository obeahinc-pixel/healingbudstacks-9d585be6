import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/components/ThemeProvider";
import ScrollToTop from "@/components/ScrollToTop";
import RouteProgress from "@/components/RouteProgress";
import CursorFollower from "@/components/CursorFollower";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import ErrorBoundary from "@/components/ErrorBoundary";
import SkipLinks from "@/components/SkipLinks";
import ProtectedRoute from "@/components/ProtectedRoute";

import { ComplianceGuard } from "@/components/ComplianceGuard";
import { CheckoutErrorFallback } from "@/components/shop/CheckoutErrorFallback";
import CookieConsentBanner from "@/components/CookieConsentBanner";

import { ShopProvider } from "@/context/ShopContext";
import { CursorProvider } from "@/context/CursorContext";
import { WalletProvider } from "@/providers/WalletProvider";
import { WalletContextProvider } from "@/context/WalletContext";
import { TenantProvider } from "@/context/TenantContext";
import { ApiEnvironmentProvider } from "@/context/ApiEnvironmentContext";
import { TruthProvider } from "@/context/TruthProvider";


// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Eligibility = lazy(() => import("./pages/Eligibility"));
const Support = lazy(() => import("./pages/Support"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Conditions = lazy(() => import("./pages/Conditions"));
const Traceability = lazy(() => import("./pages/Traceability"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const NotFound = lazy(() => import("./pages/NotFound"));
const NotEligible = lazy(() => import("./pages/NotEligible"));
const Auth = lazy(() => import("./pages/Auth"));
const Shop = lazy(() => import("./pages/Shop"));
const ShopRegister = lazy(() => import("./pages/ShopRegister"));
const StrainDetail = lazy(() => import("./pages/StrainDetail"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const DashboardStatus = lazy(() => import("./pages/DashboardStatus"));
const PatientDashboard = lazy(() => import("./pages/PatientDashboard"));
const AdminPrescriptions = lazy(() => import("./pages/AdminPrescriptions"));
const AdminStrains = lazy(() => import("./pages/AdminStrains"));
const AdminStrainSync = lazy(() => import("./pages/AdminStrainSync"));
const AdminStrainKnowledge = lazy(() => import("./pages/AdminStrainKnowledge"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminClients = lazy(() => import("./pages/AdminClients"));
const AdminRoles = lazy(() => import("./pages/AdminRoles"));
const AdminOrders = lazy(() => import("./pages/AdminOrders"));
const AdminWalletMappings = lazy(() => import("./pages/AdminWalletMappings"));
const AdminTools = lazy(() => import("./pages/AdminTools"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const Research = lazy(() => import("./pages/Research"));
const TheWire = lazy(() => import("./pages/TheWire"));
const ArticleDetail = lazy(() => import("./pages/ArticleDetail"));


const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Suspense fallback={<PageLoadingSkeleton variant="hero" />}>
        <Routes location={location} key={location.pathname}>
          {/* Core Pages */}
          <Route path="/" element={<Index />} />
          <Route path="/eligibility" element={<Eligibility />} />
          <Route path="/support" element={<Support />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/conditions" element={<Conditions />} />
          <Route path="/traceability" element={<Traceability />} />
          <Route path="/not-eligible" element={<NotEligible />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/research" element={<Research />} />
          <Route path="/the-wire" element={<TheWire />} />
          <Route path="/the-wire/:slug" element={<ArticleDetail />} />
          
          {/* Patient Portal */}
          <Route path="/dashboard" element={<PatientDashboard />} />
          <Route path="/dashboard/status" element={<DashboardStatus />} />
          <Route path="/orders" element={
            <ComplianceGuard>
              <Orders />
            </ComplianceGuard>
          } />
          <Route path="/orders/:orderId" element={
            <ComplianceGuard>
              <OrderDetail />
            </ComplianceGuard>
          } />
          
          {/* Shop - Protected by ComplianceGuard */}
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/register" element={<ShopRegister />} />
          <Route path="/shop/strain/:strainId" element={<StrainDetail />} />
          <Route path="/checkout" element={
            <ComplianceGuard>
              <ErrorBoundary fallback={<CheckoutErrorFallback />}>
                <Checkout />
              </ErrorBoundary>
            </ComplianceGuard>
          } />
          
          {/* Admin Routes - Protected by AdminLayout (which uses useUserRole) */}
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/clients" element={<ProtectedRoute requiredRole="admin"><AdminClients /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute requiredRole="admin"><AdminOrders /></ProtectedRoute>} />
          <Route path="/admin/prescriptions" element={<ProtectedRoute requiredRole="admin"><AdminPrescriptions /></ProtectedRoute>} />
          <Route path="/admin/strains" element={<ProtectedRoute requiredRole="admin"><AdminStrains /></ProtectedRoute>} />
          <Route path="/admin/strain-sync" element={<ProtectedRoute requiredRole="admin"><AdminStrainSync /></ProtectedRoute>} />
          <Route path="/admin/strain-knowledge" element={<ProtectedRoute requiredRole="admin"><AdminStrainKnowledge /></ProtectedRoute>} />
          <Route path="/admin/roles" element={<ProtectedRoute requiredRole="admin"><AdminRoles /></ProtectedRoute>} />
          <Route path="/admin/wallet-mappings" element={<ProtectedRoute requiredRole="admin"><AdminWalletMappings /></ProtectedRoute>} />
          <Route path="/admin/tools" element={<ProtectedRoute requiredRole="admin"><AdminTools /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><AdminSettings /></ProtectedRoute>} />
          
          
          {/* Legal */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
};

const App = () => (
  <ErrorBoundary>
    <WalletProvider>
      <ThemeProvider defaultTheme="light" storageKey="healing-buds-theme">
        <CursorProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <WalletContextProvider>
                <ApiEnvironmentProvider>
                  <TruthProvider>
                  <ShopProvider>
                    <CursorFollower>
                      <Toaster />
                      <Sonner />
                      <BrowserRouter>
                        <TenantProvider>
                          <SkipLinks />
                          <ScrollToTop />
                          <RouteProgress />
                          <main id="main-content" tabIndex={-1}>
                            <AnimatedRoutes />
                          </main>
                          <CookieConsentBanner />
                        </TenantProvider>
                      </BrowserRouter>
                    </CursorFollower>
                  </ShopProvider>
                  </TruthProvider>
                </ApiEnvironmentProvider>
              </WalletContextProvider>
            </TooltipProvider>
          </QueryClientProvider>
        </CursorProvider>
      </ThemeProvider>
    </WalletProvider>
  </ErrorBoundary>
);

export default App;
