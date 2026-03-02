import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/layout/Header';
import Footer from '@/components/Footer';
import SEOHead from '@/components/SEOHead';
import { ClientOnboarding } from '@/components/shop/ClientOnboarding';
import { supabase } from '@/integrations/supabase/client';
import { User, CheckCircle2, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ExistingClient {
  id: string;
  drgreen_client_id: string;
  is_kyc_verified: boolean;
  admin_approval: string;
  kyc_link: string | null;
}

export default function ShopRegister() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [existingClient, setExistingClient] = useState<ExistingClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndRegistration = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);

      if (user) {
        const { data: client } = await supabase
          .from('drgreen_clients')
          .select('id, drgreen_client_id, is_kyc_verified, admin_approval, kyc_link')
          .eq('user_id', user.id)
          .maybeSingle();

        if (client) {
          setExistingClient(client);
        }
      }

      setIsLoading(false);
    };

    checkAuthAndRegistration();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsAuthenticated(!!session?.user);
      if (!session?.user) {
        setExistingClient(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Already registered - show status
  if (isAuthenticated && existingClient) {
    const isVerified = existingClient.is_kyc_verified && existingClient.admin_approval === 'VERIFIED';
    const isPending = existingClient.admin_approval === 'PENDING';

    return (
      <>
        <SEOHead
          title="Registration Status | Healing Buds"
          description="View your patient registration status."
        />
        <div className="min-h-screen bg-background">
          <Header />
          <main className="pt-20 pb-12">
            <div className="max-w-lg mx-auto px-4 py-12">
              <Card className="rounded-2xl shadow-lg border-border/50">
                <CardHeader className="text-center pb-4">
                  {isVerified ? (
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="h-8 w-8 text-primary" />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-amber-500" />
                    </div>
                  )}
                  <CardTitle className="text-xl">
                    {isVerified ? "You're Verified!" : 'Verification In Progress'}
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {isVerified
                      ? 'Your account is fully verified. You can now browse and purchase products.'
                      : "We're reviewing your application. You'll receive an email once approved."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <span className="text-sm text-muted-foreground">KYC Status</span>
                    <Badge variant={existingClient.is_kyc_verified ? 'default' : 'secondary'}>
                      {existingClient.is_kyc_verified ? 'Verified' : 'Pending'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <span className="text-sm text-muted-foreground">Medical Review</span>
                    <Badge variant={existingClient.admin_approval === 'VERIFIED' ? 'default' : 'secondary'}>
                      {existingClient.admin_approval === 'VERIFIED' ? 'Approved' : existingClient.admin_approval === 'PENDING' ? 'Under Review' : existingClient.admin_approval}
                    </Badge>
                  </div>

                  {isPending && existingClient.kyc_link && !existingClient.is_kyc_verified && (
                    <Button asChild className="w-full" size="lg">
                      <a href={existingClient.kyc_link} target="_blank" rel="noopener noreferrer">
                        Complete KYC Verification
                        <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  )}

                  <div className="flex gap-3 pt-2">
                    {isVerified ? (
                      <Button asChild className="flex-1" size="lg">
                        <Link to="/shop">Browse Products</Link>
                      </Button>
                    ) : (
                      <>
                        <Button asChild variant="outline" className="flex-1">
                          <Link to="/shop">Browse Products</Link>
                        </Button>
                        <Button asChild className="flex-1">
                          <Link to="/dashboard/status">View Status</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
          <Footer />
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Patient Registration | Healing Buds"
        description="Register as a medical cannabis patient. Complete our secure verification process to access pharmaceutical-grade cannabis products."
        keywords="medical cannabis registration, patient verification, KYC, medical marijuana"
      />

      <div className="min-h-screen bg-background">
        <Header />

        <main className="pt-20 pb-12">
          {isAuthenticated ? (
            <ClientOnboarding />
          ) : (
            <div className="max-w-md mx-auto text-center py-20 px-4">
              <div className="rounded-2xl bg-card border border-border/50 p-8 shadow-lg">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-3 text-foreground">Sign In to Continue</h1>
                <p className="text-muted-foreground mb-6 text-sm">
                  Create a free account or sign in to begin your patient registration.
                </p>
                <Button asChild size="lg" className="w-full">
                  <Link to="/auth?redirect=/shop/register">
                    Sign In / Create Account
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
}
