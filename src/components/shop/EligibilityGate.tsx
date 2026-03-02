import { motion } from 'framer-motion';
import { Stethoscope, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useShop } from '@/context/ShopContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Link } from 'react-router-dom';

interface EligibilityGateProps {
  children: React.ReactNode;
}

export function EligibilityGate({ children }: EligibilityGateProps) {
  const { drGreenClient, isEligible, isLoading } = useShop();
  const { isAdmin, isLoading: roleLoading } = useUserRole();

  if (isLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Admins bypass eligibility — verification is not relevant for them
  if (isAdmin || isEligible) {
    return <>{children}</>;
  }


  // No client yet — friendly welcome prompt
  if (!drGreenClient) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto py-12 px-4"
      >
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 text-center">
          <CardHeader className="pb-2">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Stethoscope className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Complete Your Medical Profile</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Set up your profile in about 3–5 minutes to access the dispensary.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <Button className="w-full" size="lg" asChild>
              <Link to="/shop/register">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Client exists but not yet eligible — show status
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto py-12 px-4"
    >
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Verification In Progress</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Your application is being reviewed. You'll receive an email once approved.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {drGreenClient.kyc_link && !drGreenClient.is_kyc_verified ? (
            <Button className="w-full" size="lg" asChild>
              <a href={drGreenClient.kyc_link} target="_blank" rel="noopener noreferrer">
                Complete KYC Verification
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          ) : (
            <div className="text-center p-4 bg-amber-500/10 rounded-xl">
              <Clock className="h-7 w-7 text-amber-500 mx-auto mb-2" />
              <p className="font-medium text-sm text-foreground">Under Medical Review</p>
              <p className="text-xs text-muted-foreground">
                This typically takes 1–2 business days.
              </p>
            </div>
          )}
          <Button variant="outline" className="w-full" asChild>
            <Link to="/dashboard/status">View Full Status</Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
