import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { useDrGreenApi } from "@/hooks/useDrGreenApi";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown,
  Copy,
  Zap,
  Database,
  Users,
  ShoppingCart,
  Package,
  Shield
} from "lucide-react";
import { toast } from "sonner";

interface ApiResponse {
  status: "idle" | "loading" | "success" | "error";
  statusCode?: number;
  data?: unknown;
  error?: string;
  duration?: number;
}

interface EndpointConfig {
  id: string;
  name: string;
  description: string;
  category: "health" | "clients" | "orders" | "strains" | "admin";
  requiresParams: boolean;
  params?: Array<{ name: string; type: "text" | "select"; options?: string[]; required: boolean }>;
  hasBody?: boolean;
  defaultBody?: Record<string, unknown>;
  supportsDebugMode?: boolean;
}

const ENDPOINTS: EndpointConfig[] = [
  // Health & Diagnostics
  { 
    id: "health-check", 
    name: "Health Check", 
    description: "Check proxy deployment and secrets configuration",
    category: "health",
    requiresParams: false 
  },
  { 
    id: "api-diagnostics", 
    name: "API Diagnostics", 
    description: "Full diagnostic with live API test",
    category: "health",
    requiresParams: false 
  },
  
  // Client Endpoints
  { 
    id: "dapp-clients", 
    name: "Get All Clients", 
    description: "List all clients (paginated)",
    category: "clients",
    requiresParams: true,
    params: [
      { name: "page", type: "text", required: false },
      { name: "take", type: "text", required: false },
      { name: "status", type: "select", options: ["Active", "Inactive", "Pending"], required: false }
    ]
  },
  { 
    id: "dapp-client-details", 
    name: "Get Client Details", 
    description: "Get details for a specific client",
    category: "clients",
    requiresParams: true,
    params: [{ name: "clientId", type: "text", required: true }]
  },
  { 
    id: "get-user-me", 
    name: "Get User Me", 
    description: "Get current authenticated Dr Green user",
    category: "clients",
    requiresParams: false 
  },
  { 
    id: "create-client-legacy", 
    name: "Create Client (Legacy)", 
    description: "Create a new client with legacy payload format - triggers First AML KYC",
    category: "clients",
    requiresParams: false,
    hasBody: true,
    supportsDebugMode: true,
    defaultBody: {
      firstName: "Test",
      lastName: "User",
      email: "test@healingbuds.co.za",
      phoneCode: "+351",
      phoneCountryCode: "PT",
      contactNumber: "912345678",
      shipping: {
        address1: "Rua Test 123",
        city: "Lisboa",
        state: "",
        country: "PT",
        countryCode: "PRT",
        postalCode: "1000-001"
      },
      medicalRecord: {
        dob: "1990-05-15",
        gender: "male",
        medicalHistory0: true,
        medicalHistory3: true,
        medicalConditions: ["chronic_pain", "anxiety"],
        medicinesTreatments: ["ibuprofen"]
      }
    }
  },
  { 
    id: "activate-client", 
    name: "Activate Client", 
    description: "Activate a client account",
    category: "clients",
    requiresParams: true,
    params: [{ name: "clientId", type: "text", required: true }]
  },
  { 
    id: "deactivate-client", 
    name: "Deactivate Client", 
    description: "Deactivate a client account",
    category: "clients",
    requiresParams: true,
    params: [{ name: "clientId", type: "text", required: true }]
  },
  
  // Order Endpoints
  { 
    id: "dapp-orders", 
    name: "Get All Orders", 
    description: "List all orders (paginated)",
    category: "orders",
    requiresParams: true,
    params: [
      { name: "page", type: "text", required: false },
      { name: "take", type: "text", required: false }
    ]
  },
  { 
    id: "dapp-order-details", 
    name: "Get Order Details", 
    description: "Get details for a specific order",
    category: "orders",
    requiresParams: true,
    params: [{ name: "orderId", type: "text", required: true }]
  },
  
  // Strain Endpoints
  { 
    id: "get-strains", 
    name: "Get Strains", 
    description: "Get strains by country code",
    category: "strains",
    requiresParams: true,
    params: [
      { name: "countryCode", type: "select", options: ["PRT", "GBR", "ZAF", "THA"], required: true }
    ]
  },
  { 
    id: "dapp-strains", 
    name: "Dapp Strains", 
    description: "Get strains (admin view)",
    category: "strains",
    requiresParams: true,
    params: [
      { name: "countryCode", type: "select", options: ["PRT", "GBR", "ZAF", "THA"], required: false }
    ]
  },
  
  // Admin Endpoints
  { 
    id: "dashboard-summary", 
    name: "Dashboard Summary", 
    description: "Get dashboard statistics",
    category: "admin",
    requiresParams: false 
  },
  { 
    id: "sales-summary", 
    name: "Sales Summary", 
    description: "Get sales statistics",
    category: "admin",
    requiresParams: false 
  },
  { 
    id: "dapp-nfts", 
    name: "Get NFTs", 
    description: "Get associated NFTs",
    category: "admin",
    requiresParams: false 
  },
];

const categoryIcons: Record<string, React.ReactNode> = {
  health: <Zap className="h-4 w-4" />,
  clients: <Users className="h-4 w-4" />,
  orders: <ShoppingCart className="h-4 w-4" />,
  strains: <Package className="h-4 w-4" />,
  admin: <Database className="h-4 w-4" />,
};

const categoryColors: Record<string, string> = {
  health: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  clients: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  orders: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  strains: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  admin: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

export function ApiDebugPanel() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>("health-check");
  const [params, setParams] = useState<Record<string, string>>({});
  const [bodyJson, setBodyJson] = useState<string>("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [debugKey, setDebugKey] = useState("");
  const [response, setResponse] = useState<ApiResponse>({ status: "idle" });
  const [history, setHistory] = useState<Array<{ endpoint: string; response: ApiResponse; timestamp: Date }>>([]);
  const { callProxy } = useDrGreenApi();

  const endpoint = ENDPOINTS.find(e => e.id === selectedEndpoint);

  // Initialize body JSON when endpoint changes
  React.useEffect(() => {
    if (endpoint?.hasBody && endpoint.defaultBody) {
      setBodyJson(JSON.stringify(endpoint.defaultBody, null, 2));
      setBodyError(null);
    } else {
      setBodyJson("");
      setBodyError(null);
    }
  }, [selectedEndpoint, endpoint]);

  const handleParamChange = (name: string, value: string) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const handleBodyChange = (value: string) => {
    setBodyJson(value);
    try {
      JSON.parse(value);
      setBodyError(null);
    } catch (e) {
      setBodyError("Invalid JSON");
    }
  };

  const executeRequest = async () => {
    if (!endpoint) return;

    // Validate body JSON if endpoint has body
    if (endpoint.hasBody && bodyError) {
      toast.error("Please fix the JSON body before executing");
      return;
    }

    // Validate debug key if debug mode is enabled for supported endpoints
    if (debugMode && endpoint.supportsDebugMode && !debugKey.trim()) {
      toast.error("Debug key is required when debug mode is enabled");
      return;
    }

    setResponse({ status: "loading" });
    const startTime = performance.now();

    try {
      // Build request body
      const requestBody: Record<string, unknown> = { 
        action: endpoint.id, 
        ...params 
      };

      // Add payload for endpoints with body
      if (endpoint.hasBody && bodyJson) {
        try {
          requestBody.payload = JSON.parse(bodyJson);
        } catch {
          toast.error("Invalid JSON body");
          setResponse({ status: "idle" });
          return;
        }
      }

      // Use fetch with custom headers for debug mode
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      };

      // Add debug header if debug mode is enabled for this endpoint
      if (debugMode && endpoint.supportsDebugMode && debugKey.trim()) {
        headers['x-admin-debug-key'] = debugKey.trim();
        console.log('[ApiDebugPanel] Debug mode enabled, adding x-admin-debug-key header');
      }

      const fetchResponse = await fetch(`${supabaseUrl}/functions/v1/drgreen-proxy`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const data = await fetchResponse.json();

      const duration = Math.round(performance.now() - startTime);

      if (!fetchResponse.ok) {
        const errorResponse: ApiResponse = {
          status: "error",
          statusCode: fetchResponse.status,
          error: data?.error || data?.message || `HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`,
          duration,
        };
        setResponse(errorResponse);
        setHistory(prev => [{ endpoint: endpoint.id, response: errorResponse, timestamp: new Date() }, ...prev.slice(0, 9)]);
      } else {
        const successResponse: ApiResponse = {
          status: "success",
          statusCode: fetchResponse.status,
          data,
          duration,
        };
        setResponse(successResponse);
        setHistory(prev => [{ endpoint: endpoint.id, response: successResponse, timestamp: new Date() }, ...prev.slice(0, 9)]);
      }
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      const errorResponse: ApiResponse = {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
        duration,
      };
      setResponse(errorResponse);
      setHistory(prev => [{ endpoint: endpoint.id, response: errorResponse, timestamp: new Date() }, ...prev.slice(0, 9)]);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const groupedEndpoints = ENDPOINTS.reduce((acc, ep) => {
    if (!acc[ep.category]) acc[ep.category] = [];
    acc[ep.category].push(ep);
    return acc;
  }, {} as Record<string, EndpointConfig[]>);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          API Debug Panel
        </CardTitle>
        <CardDescription>
          Test Dr Green API endpoints interactively and diagnose issues
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="test" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="test">Test Endpoint</TabsTrigger>
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="test" className="space-y-4 mt-4">
            {/* Endpoint Selection */}
            <div className="space-y-2">
              <Label>Select Endpoint</Label>
              <Select value={selectedEndpoint} onValueChange={setSelectedEndpoint}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an endpoint..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedEndpoints).map(([category, endpoints]) => (
                    <React.Fragment key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
                        {categoryIcons[category]}
                        {category}
                      </div>
                      {endpoints.map(ep => (
                        <SelectItem key={ep.id} value={ep.id}>
                          <div className="flex items-center gap-2">
                            <span>{ep.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </React.Fragment>
                  ))}
                </SelectContent>
              </Select>
              {endpoint && (
                <p className="text-sm text-muted-foreground">{endpoint.description}</p>
              )}
            </div>

            {/* Parameters */}
            {endpoint?.requiresParams && endpoint.params && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <Label className="text-sm font-medium">Parameters</Label>
                <div className="grid gap-3">
                  {endpoint.params.map(param => (
                    <div key={param.name} className="space-y-1">
                      <Label htmlFor={param.name} className="text-xs">
                        {param.name}
                        {param.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {param.type === "select" && param.options ? (
                        <Select 
                          value={params[param.name] || ""} 
                          onValueChange={(v) => handleParamChange(param.name, v)}
                        >
                          <SelectTrigger id={param.name}>
                            <SelectValue placeholder={`Select ${param.name}...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {param.options.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={param.name}
                          value={params[param.name] || ""}
                          onChange={(e) => handleParamChange(param.name, e.target.value)}
                          placeholder={`Enter ${param.name}...`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Body Editor for POST endpoints */}
            {endpoint?.hasBody && (
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Request Body (JSON)</Label>
                  {bodyError && (
                    <Badge variant="destructive" className="text-xs">{bodyError}</Badge>
                  )}
                </div>
                <Textarea
                  value={bodyJson}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  className="font-mono text-xs min-h-[200px] resize-y"
                  placeholder="Enter JSON payload..."
                />
                <p className="text-xs text-muted-foreground">
                  This payload mirrors the onboarding form structure. Modify to test different scenarios.
                </p>
              </div>
            )}

            {/* Debug Mode Toggle - only show for supported endpoints */}
            {endpoint?.supportsDebugMode && (
              <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-600" />
                    <Label className="text-sm font-medium text-amber-700 dark:text-amber-400">Admin Debug Mode</Label>
                  </div>
                  <Switch
                    checked={debugMode}
                    onCheckedChange={setDebugMode}
                  />
                </div>
                {debugMode && (
                  <div className="space-y-2">
                    <Label htmlFor="debug-key" className="text-xs text-amber-600 dark:text-amber-400">
                      Debug Key (first 16 chars of DRGREEN_PRIVATE_KEY)
                    </Label>
                    <Input
                      id="debug-key"
                      type="password"
                      value={debugKey}
                      onChange={(e) => setDebugKey(e.target.value)}
                      placeholder="Enter debug key..."
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                      ⚠️ Debug mode bypasses authentication. Use only for testing.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Execute Button */}
            <Button 
              onClick={executeRequest} 
              disabled={response.status === "loading"}
              className="w-full"
            >
              {response.status === "loading" ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Execute Request
                </>
              )}
            </Button>

            {/* Response */}
            {response.status !== "idle" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {response.status === "loading" && (
                      <Badge variant="secondary" className="gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Loading
                      </Badge>
                    )}
                    {response.status === "success" && (
                      <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Success
                      </Badge>
                    )}
                    {response.status === "error" && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Error
                      </Badge>
                    )}
                    {response.duration && (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {response.duration}ms
                      </Badge>
                    )}
                  </div>
                  {response.data && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(JSON.stringify(response.data, null, 2))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <ScrollArea className="h-[300px] w-full rounded-md border">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                    {response.error 
                      ? response.error 
                      : JSON.stringify(response.data, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No request history yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {history.map((item, i) => (
                    <Collapsible key={i}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            {item.response.status === "success" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <span className="font-mono text-sm">{item.endpoint}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {item.timestamp.toLocaleTimeString()}
                            </span>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-3 bg-muted/30 rounded-b-lg border-x border-b -mt-1">
                          <pre className="text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-auto">
                            {item.response.error 
                              ? item.response.error 
                              : JSON.stringify(item.response.data, null, 2)}
                          </pre>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
