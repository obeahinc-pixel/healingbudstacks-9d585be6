import { useState } from "react";
import AdminLayout from "@/layout/AdminLayout";
import { ApiTestRunner } from "@/components/admin/ApiTestRunner";
import { ApiComparisonDashboard } from "@/components/admin/ApiComparisonDashboard";
import { ApiDebugPanel } from "@/components/admin/ApiDebugPanel";
import { BatchImageGenerator } from "@/components/admin/BatchImageGenerator";
import { AdminClientImport } from "@/components/admin/AdminClientImport";
import { AdminEmailTrigger } from "@/components/admin/AdminEmailTrigger";
import { KYCJourneyViewer } from "@/components/admin/KYCJourneyViewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Newspaper, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const RefreshWireButton = () => {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("fetch-wire-articles", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (error) throw error;
      toast.success(`Fetched ${data?.inserted || 0} new articles`);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch articles");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          The Wire – News Fetcher
        </CardTitle>
        <CardDescription>
          Fetch latest cannabis industry news from RSS feeds and auto-publish to The Wire
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Fetching..." : "Refresh News"}
        </Button>
      </CardContent>
    </Card>
  );
};

const RepairAccountsButton = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRepair = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("repair-accounts", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      setResult(data?.results);
      toast.success(`Repair complete: ${data?.results?.accounts_created || 0} accounts created, ${data?.results?.linked_existing || 0} linked`);
    } catch (err: any) {
      toast.error(err.message || "Repair failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Account Repair Tool
        </CardTitle>
        <CardDescription>
          Find unlinked client records, create missing auth accounts, send password reset emails, and link everything together.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleRepair} disabled={loading} variant="destructive">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Repairing..." : "Run Account Repair"}
        </Button>
        {result && (
          <div className="text-sm space-y-1 p-3 rounded bg-muted">
            <p>Total unlinked: <strong>{result.total_unlinked}</strong></p>
            <p>Linked to existing auth: <strong>{result.linked_existing}</strong></p>
            <p>New accounts created: <strong>{result.accounts_created}</strong></p>
            <p>Reset emails sent: <strong>{result.reset_emails_sent}</strong></p>
            {result.errors?.length > 0 && (
              <div className="mt-2 text-destructive">
                <p>Errors:</p>
                {result.errors.map((e: string, i: number) => <p key={i}>• {e}</p>)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AdminTools = () => (
  <AdminLayout
    title="Developer Tools"
    description="API testing, debugging, and data import utilities"
  >
    <div className="space-y-8">
      <RepairAccountsButton />
      <RefreshWireButton />
      <ApiTestRunner />
      <ApiComparisonDashboard />
      <ApiDebugPanel />
      <BatchImageGenerator />
      <KYCJourneyViewer />
      <AdminEmailTrigger />
      <AdminClientImport />
    </div>
  </AdminLayout>
);

export default AdminTools;
