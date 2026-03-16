import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Download,
  Loader2,
  User,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Mail,
  Shield,
  Globe,
  ExternalLink,
  UserPlus,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DrGreenClient {
  id?: string;
  clientId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  countryCode?: string;
  country?: string;
  isKYCVerified?: boolean;
  adminApproval?: string;
  kycLink?: string;
  createdAt?: string;
}

interface SearchResult {
  success: boolean;
  message: string;
  client?: DrGreenClient;
  searchResults?: number;
  error?: string;
  synced?: boolean;
  apiStatus?: number;
}

export function AdminClientImport() {
  const { toast } = useToast();
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [foundClient, setFoundClient] = useState<DrGreenClient | null>(null);

  const handleSearch = async () => {
    if (!searchEmail.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address to search.',
        variant: 'destructive',
      });
      return;
    }

    setSearching(true);
    setSearchResult(null);
    setFoundClient(null);

    try {
      const { data, error } = await supabase.functions.invoke('drgreen-proxy', {
        body: {
          action: 'sync-client-by-email',
          email: searchEmail.trim().toLowerCase(),
          // Don't pass localUserId - just search, don't sync yet
        },
      });

      if (error) {
        console.error('Search error:', error);
        setSearchResult({
          success: false,
          message: error.message || 'Failed to search Dr Green API',
          error: 'api_error',
        });
        return;
      }

      setSearchResult(data);
      if (data?.success && data?.client) {
        setFoundClient(data.client);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchResult({
        success: false,
        message: err.message || 'An unexpected error occurred',
        error: 'unknown',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async () => {
    if (!foundClient) return;

    setImporting(true);
    try {
      // First, check if there's an existing Supabase user with this email
      // We need to get the user ID to link the client record
      
      // For now, we'll create a placeholder record without a user_id link
      // The admin can manually link it later or the user can claim it
      
      const clientId = foundClient.id || foundClient.clientId;
      const fullName = foundClient.fullName || 
        `${foundClient.firstName || ''} ${foundClient.lastName || ''}`.trim();

      // Check if this client already exists locally
      const { data: existingClient } = await supabase
        .from('drgreen_clients')
        .select('id, user_id')
        .eq('drgreen_client_id', clientId)
        .maybeSingle();

      if (existingClient) {
        toast({
          title: 'Client Already Exists',
          description: 'This client is already in the local database.',
        });
        setImporting(false);
        return;
      }

      // Use the sync endpoint with a service call that will create a placeholder
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('drgreen-proxy', {
        body: {
          action: 'sync-client-by-email',
          email: searchEmail.trim().toLowerCase(),
          // Create a placeholder user_id based on email hash for orphaned records
          localUserId: null, // Will be handled by edge function
        },
      });

      // For clients without a local user account, insert as unclaimed (user_id = null)
      // The auto_link_drgreen_on_signup trigger will link them when they sign up
      const { error: insertError } = await supabase
        .from('drgreen_clients')
        .insert({
          user_id: null, // Unclaimed - auto-linked when user signs up with matching email
          drgreen_client_id: clientId!,
          email: foundClient.email || null,
          full_name: fullName || null,
          country_code: foundClient.countryCode || foundClient.country || 'PT',
          is_kyc_verified: foundClient.isKYCVerified || false,
          admin_approval: foundClient.adminApproval || 'PENDING',
          kyc_link: foundClient.kycLink || null,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          toast({
            title: 'Duplicate Entry',
            description: 'This client already exists in the local database.',
          });
        } else {
          throw insertError;
        }
      } else {
        toast({
          title: 'Client Imported!',
          description: `${fullName || foundClient.email} has been imported to the local database.`,
        });
        
        // Clear the search
        setSearchResult({
          success: true,
          message: 'Client successfully imported',
          synced: true,
        });
      }
    } catch (err: any) {
      console.error('Import error:', err);
      toast({
        title: 'Import Failed',
        description: err.message || 'Failed to import client to local database.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const getStatusBadge = (client: DrGreenClient) => {
    if (client.isKYCVerified && client.adminApproval === 'VERIFIED') {
      return <Badge className="bg-green-500">Fully Verified</Badge>;
    }
    if (client.isKYCVerified) {
      return <Badge variant="outline" className="border-blue-500 text-blue-600">KYC Complete</Badge>;
    }
    if (client.adminApproval === 'REJECTED') {
      return <Badge variant="destructive">Rejected</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Download className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Import Client from Dr. Green</CardTitle>
            <CardDescription>
              Search for clients on the Dr. Green API and import them to the local database
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-email">Search by Email</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search-email"
                  type="email"
                  placeholder="Enter client email address..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={searching || !searchEmail.trim()}
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* API Permission Warning */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">
                Requires Dr. Green API admin permissions. If you see 401 errors, update your API credentials.
              </span>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Separator />

            {searchResult.success && foundClient ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Client Found on Dr. Green</span>
                </div>

                {/* Client Details Card */}
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {foundClient.fullName || 
                            `${foundClient.firstName || ''} ${foundClient.lastName || ''}`.trim() || 
                            'Unknown Name'}
                        </p>
                        <p className="text-sm text-muted-foreground">{foundClient.email}</p>
                      </div>
                    </div>
                    {getStatusBadge(foundClient)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Client ID:</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">
                        {(foundClient.id || foundClient.clientId)?.slice(0, 12)}...
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Region:</span>
                      <Badge variant="outline">
                        {foundClient.countryCode || foundClient.country || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">KYC:</span>
                      <span>{foundClient.isKYCVerified ? 'Verified' : 'Pending'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Approval:</span>
                      <span>{foundClient.adminApproval || 'PENDING'}</span>
                    </div>
                  </div>

                  {foundClient.kycLink && (
                    <div className="mt-4 pt-4 border-t">
                      <a
                        href={foundClient.kycLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        View KYC Verification Link
                      </a>
                    </div>
                  )}
                </div>

                {/* Import Button */}
                {!searchResult.synced && (
                  <Button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full"
                  >
                    {importing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <UserPlus className="w-4 h-4 mr-2" />
                    )}
                    Import to Local Database
                  </Button>
                )}

                {searchResult.synced && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-700 dark:text-green-400">
                    <CheckCircle className="w-4 h-4 inline mr-2" />
                    Client has been successfully imported to the local database.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">
                    {searchResult.apiStatus === 401 
                      ? 'API Permission Denied'
                      : 'Client Not Found'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{searchResult.message}</p>
                
                {searchResult.apiStatus === 401 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    The current API credentials don't have permission to access client data.
                    Update DRGREEN_API_KEY and DRGREEN_PRIVATE_KEY with admin credentials.
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
