import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/layout/Header';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';
import { useShop } from '@/context/ShopContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Lock, UserCircle, FileText, Shield, Loader2, RefreshCw, AlertTriangle, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';

interface VerificationStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  status: 'complete' | 'current' | 'pending';
}

export default function DashboardStatus() {
  const navigate = useNavigate();
  const { drGreenClient, isLoading, syncVerificationFromDrGreen, refreshClient } = useShop();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lookupResult, setLookupResult] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const { toast } = useToast();
  const { isAdmin, isLoading: roleLoading } = useUserRole();

  // Admin should never land on verification page — redirect to admin dashboard
  useEffect(() => {
    if (!roleLoading && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [isAdmin, roleLoading, navigate]);

  // Manual lookup from Dr. Green API
  const handleManualLookup = useCallback(async () => {
    setIsLookingUp(true);
    setLookupResult('Checking Dr. Green records...');
    
    try {
      const { data, error } = await supabase.functions.invoke('drgreen-proxy', {
        body: { action: 'get-client-by-auth-email' },
      });
      
      if (error) {
        setLookupResult('Error: Could not connect to verification system');
        toast({
          title: 'Lookup Failed',
          description: 'Could not connect to the verification system.',
          variant: 'destructive',
        });
        return;
      }
      
      if (data?.found) {
        const status = data.adminApproval === 'VERIFIED' && data.isKYCVerified
          ? '✓ Verified'
          : data.adminApproval === 'PENDING'
          ? '⏳ Pending Approval'
          : `Status: ${data.adminApproval}`;
        
        setLookupResult(`Found! ${data.firstName || ''} ${data.lastName || ''} - ${status}`);
        
        // Refresh the client data to update local state
        await refreshClient();
        
        toast({
          title: 'Profile Found',
          description: `Your profile has been located. Status: ${data.adminApproval}`,
        });
      } else {
        setLookupResult(`No profile found for your email address. Checked ${data?.totalClientsChecked || 0} records.`);
        toast({
          title: 'No Profile Found',
          description: 'Please complete registration to create your profile.',
        });
      }
    } catch (err) {
      setLookupResult('Error: Connection failed');
      toast({
        title: 'Connection Error',
        description: 'Please check your connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLookingUp(false);
    }
  }, [refreshClient, toast]);

  // Manual refresh handler
  const handleRefreshStatus = useCallback(async () => {
    setIsSyncing(true);
    try {
      await syncVerificationFromDrGreen();
      toast({
        title: 'Status Updated',
        description: 'Your verification status has been refreshed.',
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Could not refresh status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  }, [syncVerificationFromDrGreen, toast]);

  // Auto-sync on mount and then every 30 seconds for pending verifications
  useEffect(() => {
    if (!isLoading && drGreenClient && !drGreenClient.is_kyc_verified) {
      // Immediate sync on mount
      syncVerificationFromDrGreen();
      
      // Then poll every 30 seconds
      const interval = setInterval(() => {
        syncVerificationFromDrGreen();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [drGreenClient, isLoading, syncVerificationFromDrGreen]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      
      if (!user) {
        navigate('/auth?redirect=/dashboard/status', { replace: true });
      }
    };

    checkAuth();
  }, [navigate]);

  // If user becomes verified, redirect to shop
  useEffect(() => {
    if (!isLoading && drGreenClient) {
      const isVerified = drGreenClient.is_kyc_verified === true && 
                        drGreenClient.admin_approval === 'VERIFIED';
      if (isVerified) {
        navigate('/shop', { replace: true });
      }
    }
  }, [drGreenClient, isLoading, navigate]);

  // Auto-trigger lookup when no client found (seamless discovery)
  const [autoLookupDone, setAutoLookupDone] = useState(false);
  
  useEffect(() => {
    if (!isLoading && !drGreenClient && isAuthenticated && !isLookingUp && !autoLookupDone) {
      setAutoLookupDone(true);
      handleManualLookup();
    }
  }, [isLoading, drGreenClient, isAuthenticated, isLookingUp, autoLookupDone, handleManualLookup]);

  // If user has no client record, redirect immediately to registration
  useEffect(() => {
    if (!isLoading && !drGreenClient && isAuthenticated && autoLookupDone && !isLookingUp) {
      navigate('/shop/register', { replace: true });
    }
  }, [drGreenClient, isLoading, isAuthenticated, autoLookupDone, isLookingUp, navigate]);

  if (isAuthenticated === null || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Determine current verification status
  const hasClient = !!drGreenClient;
  const isKycVerified = drGreenClient?.is_kyc_verified === true;
  const adminApproval = drGreenClient?.admin_approval;
  const hasLocalClientId = drGreenClient?.drgreen_client_id?.startsWith('local-');

  const getStepStatus = (stepId: string): 'complete' | 'current' | 'pending' => {
    switch (stepId) {
      case 'registration':
        return hasClient ? 'complete' : 'current';
      case 'kyc':
        if (!hasClient) return 'pending';
        return isKycVerified ? 'complete' : 'current';
      case 'review':
        if (!hasClient || !isKycVerified) return 'pending';
        if (adminApproval === 'VERIFIED') return 'complete';
        if (adminApproval === 'PENDING' || adminApproval === 'SUBMITTED') return 'current';
        return 'pending';
      case 'access':
        if (adminApproval === 'VERIFIED') return 'complete';
        return 'pending';
      default:
        return 'pending';
    }
  };

  const steps: VerificationStep[] = [
    {
      id: 'registration',
      title: 'Registration Complete',
      description: 'Your medical profile has been submitted',
      icon: UserCircle,
      status: getStepStatus('registration'),
    },
    {
      id: 'kyc',
      title: 'Identity Verification',
      description: 'Complete KYC verification process',
      icon: FileText,
      status: getStepStatus('kyc'),
    },
    {
      id: 'review',
      title: 'Medical Review',
      description: 'Your profile is being reviewed by our medical team',
      icon: Shield,
      status: getStepStatus('review'),
    },
    {
      id: 'access',
      title: 'Dispensary Access',
      description: 'Full access to medical cannabis products',
      icon: Lock,
      status: getStepStatus('access'),
    },
  ];

  const getStatusMessage = () => {
    if (!hasClient) {
      return 'Please complete your medical profile registration to continue.';
    }
    if (!isKycVerified) {
      return 'Please complete identity verification (KYC) to proceed with your application.';
    }
    if (adminApproval === 'REJECTED') {
      return 'Your application has been declined. Please contact support for more information.';
    }
    return 'Your medical profile is currently under review. You cannot access the dispensary until verified.';
  };

  const getActionButton = () => {
    if (!hasClient) {
      return (
        <Button asChild size="lg" className="rounded-2xl">
          <Link to="/shop/register">Complete Registration</Link>
        </Button>
      );
    }
    if (!isKycVerified && drGreenClient?.kyc_link) {
      return (
        <Button asChild size="lg" className="rounded-2xl">
          <a href={drGreenClient.kyc_link} target="_blank" rel="noopener noreferrer">
            Complete KYC Verification
          </a>
        </Button>
      );
    }
    return (
      <Button asChild variant="outline" size="lg" className="rounded-2xl">
        <Link to="/shop/register">Update Medical Profile</Link>
      </Button>
    );
  };

  return (
    <>
      <SEOHead
        title="Account Status | Healing Buds"
        description="View your account verification status and complete any pending steps."
      />

      <div className="min-h-screen bg-background">
        <Header />

        <main className="pt-24 pb-16">
          <div className="container max-w-2xl mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="border-border/50 shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-amber-500" />
                  </div>
                  <CardTitle className="text-2xl font-semibold">Account Pending Approval</CardTitle>
                  <CardDescription className="text-base mt-2">
                    {getStatusMessage()}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-6">
                  {/* No Profile Found - Direct link to registration */}
                  {!hasClient && (
                    <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-700 dark:text-amber-400">No Medical Profile Found</AlertTitle>
                      <AlertDescription className="text-amber-600 dark:text-amber-300">
                        We couldn't find a registered profile for your email. Please complete registration to continue.
                      </AlertDescription>
                      <div className="mt-3">
                        <Button 
                          asChild 
                          size="sm" 
                          className="bg-amber-600 hover:bg-amber-500"
                        >
                          <Link to="/shop/register">Complete Registration</Link>
                        </Button>
                      </div>
                    </Alert>
                  )}

                  {/* Manual Lookup Section */}
                  {!hasClient && (
                    <div className="mb-6 p-4 rounded-xl border border-border bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-sm">Check Existing Profile</h3>
                        {lookupResult && (
                          <Badge variant={lookupResult.includes('Found!') ? 'default' : 'secondary'} className="text-xs">
                            {lookupResult.includes('Found!') ? 'Found' : 'Not Found'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Already registered with Dr. Green? Check if your profile exists.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualLookup}
                        disabled={isLookingUp}
                        className="w-full"
                      >
                        {isLookingUp ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="mr-2 h-4 w-4" />
                        )}
                        {isLookingUp ? 'Checking...' : 'Look Up My Profile'}
                      </Button>
                      {lookupResult && (
                        <p className={`mt-3 text-xs ${lookupResult.includes('Found!') ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                          {lookupResult}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Sync Required Alert */}
                  {hasLocalClientId && (
                    <Alert variant="default" className="mb-6 border-amber-500/30 bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-700 dark:text-amber-400">Registration Sync Required</AlertTitle>
                      <AlertDescription className="text-amber-600 dark:text-amber-300">
                        Your registration wasn't fully synced with our verification provider. 
                        Please complete registration again to receive your KYC verification email from First AML.
                      </AlertDescription>
                      <Button 
                        asChild 
                        size="sm" 
                        className="mt-3 bg-amber-600 hover:bg-amber-500"
                      >
                        <Link to="/shop/register">Complete Registration</Link>
                      </Button>
                    </Alert>
                  )}

                  {/* Progress Tracker */}
                  <div className="space-y-4 mb-8">
                    {steps.map((step, index) => {
                      const Icon = step.icon;
                      const isComplete = step.status === 'complete';
                      const isCurrent = step.status === 'current';

                      return (
                        <div key={step.id} className="flex items-start gap-4">
                          {/* Step indicator */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                                isComplete
                                  ? 'bg-emerald-500 text-white'
                                  : isCurrent
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {isComplete ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : isCurrent ? (
                                <Clock className="w-5 h-5" />
                              ) : (
                                <Icon className="w-5 h-5" />
                              )}
                            </div>
                            {index < steps.length - 1 && (
                              <div
                                className={`w-0.5 h-8 mt-2 ${
                                  isComplete ? 'bg-emerald-500' : 'bg-muted'
                                }`}
                              />
                            )}
                          </div>

                          {/* Step content */}
                          <div className="flex-1 pt-1">
                            <h3
                              className={`font-medium ${
                                isComplete
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isCurrent
                                  ? 'text-foreground'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {step.title}
                              {isComplete && ' ✓'}
                              {isCurrent && ' (In Progress)'}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                    {getActionButton()}
                    {hasClient && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleRefreshStatus}
                        disabled={isSyncing}
                        className="rounded-2xl"
                      >
                        {isSyncing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Refresh Status
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
}
