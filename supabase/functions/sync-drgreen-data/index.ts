import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as secp256k1 from "https://esm.sh/@noble/secp256k1@2.1.0";
import { sha256 } from "https://esm.sh/@noble/hashes@1.4.0/sha256";
import { hmac } from "https://esm.sh/@noble/hashes@1.4.0/hmac";

// Initialize secp256k1 HMAC
secp256k1.etc.hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]) => {
  const h = hmac.create(sha256, key);
  for (const msg of messages) h.update(msg);
  return h.digest();
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DRGREEN_API_URL = "https://api.drgreennft.com/api/v1";

// ── Base64 helpers ──────────────────────────────────────────
function cleanBase64(b64: string): string {
  let c = (b64 || '').replace(/[\s\r\n"']/g, '').trim();
  c = c.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (c.length % 4)) % 4;
  if (pad > 0 && pad < 4) c += '='.repeat(pad);
  return c;
}

function base64ToBytes(b64: string): Uint8Array {
  const c = cleanBase64(b64);
  const bin = atob(c);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function isBase64(str: string): boolean {
  const c = cleanBase64(str);
  return c.length > 0 && /^[A-Za-z0-9+/]*=*$/.test(c);
}

// ── Key extraction (same as drgreen-proxy) ──────────────────
function extractSecp256k1PrivateKey(derBytes: Uint8Array): Uint8Array {
  let offset = 0;
  function readLength(): number {
    const fb = derBytes[offset++];
    if (fb < 0x80) return fb;
    const n = fb & 0x7f;
    let len = 0;
    for (let i = 0; i < n; i++) len = (len << 8) | derBytes[offset++];
    return len;
  }
  if (derBytes.length === 32) return derBytes;
  if (derBytes[offset++] !== 0x30) throw new Error('Expected SEQUENCE');
  readLength();
  const nextTag = derBytes[offset];
  if (nextTag === 0x02) {
    // INTEGER — structured key
    if (derBytes[offset++] !== 0x02) throw new Error('Expected INTEGER');
    const vLen = readLength();
    let version = 0;
    for (let i = 0; i < vLen; i++) version = (version << 8) | derBytes[offset + i];
    offset += vLen;
    if (version === 1) {
      // SEC1
      if (derBytes[offset++] !== 0x04) throw new Error('Expected OCTET STRING');
      const kLen = readLength();
      if (kLen !== 32) throw new Error(`Expected 32-byte key, got ${kLen}`);
      return derBytes.slice(offset, offset + 32);
    } else if (version === 0) {
      // PKCS#8
      if (derBytes[offset++] !== 0x30) throw new Error('Expected SEQUENCE (alg)');
      const algLen = readLength();
      offset += algLen;
      if (derBytes[offset++] !== 0x04) throw new Error('Expected OCTET STRING');
      readLength();
      if (derBytes[offset++] !== 0x30) throw new Error('Expected SEQUENCE (SEC1)');
      readLength();
      if (derBytes[offset++] !== 0x02) throw new Error('Expected INTEGER');
      const svLen = readLength();
      offset += svLen;
      if (derBytes[offset++] !== 0x04) throw new Error('Expected OCTET STRING');
      const kLen = readLength();
      if (kLen !== 32) throw new Error(`Expected 32-byte key, got ${kLen}`);
      return derBytes.slice(offset, offset + 32);
    }
    throw new Error(`Unexpected key version: ${version}`);
  }
  if (nextTag === 0x04) {
    offset++;
    const kLen = readLength();
    if (kLen === 32) return derBytes.slice(offset, offset + 32);
  }
  throw new Error(`Unsupported key format`);
}

// ── Signing ─────────────────────────────────────────────────
async function signPayload(data: string, base64PrivateKey: string): Promise<string> {
  const secret = (base64PrivateKey || '').trim();
  let decodedBytes = base64ToBytes(secret);
  const decoded = new TextDecoder().decode(decodedBytes);
  const isPem = decoded.includes('-----BEGIN') || decoded.includes('BEGIN') ||
    (decodedBytes.length >= 2 && decodedBytes[0] === 0x2D && decodedBytes[1] === 0x2D);

  function extractPemBody(text: string): string {
    return text.replace(/-----BEGIN [A-Z0-9 ]+-----/g, '')
      .replace(/-----END [A-Z0-9 ]+-----/g, '')
      .replace(/-{2,}[^\n]*\n?/g, '')
      .replace(/[\r\n\s]/g, '').trim();
  }

  let keyDerBytes: Uint8Array;
  if (isPem) {
    const body = extractPemBody(decoded);
    keyDerBytes = isBase64(body) ? base64ToBytes(body) : decodedBytes;
  } else if (decodedBytes.length >= 150 && decodedBytes.length <= 500) {
    const body = extractPemBody(decoded);
    keyDerBytes = (body && isBase64(body)) ? base64ToBytes(body) : decodedBytes;
  } else {
    keyDerBytes = decodedBytes;
  }

  const privateKeyBytes = extractSecp256k1PrivateKey(keyDerBytes);
  const encoder = new TextEncoder();
  const messageHash = sha256(encoder.encode(data));
  const signature = secp256k1.sign(messageHash, privateKeyBytes);
  const compact = signature.toCompactRawBytes();
  const r = compact.slice(0, 32);
  const s = compact.slice(32, 64);

  function intToDER(val: Uint8Array): Uint8Array {
    let start = 0;
    while (start < val.length - 1 && val[start] === 0) start++;
    let trimmed = val.slice(start);
    const pad = trimmed[0] >= 0x80;
    const res = new Uint8Array((pad ? 1 : 0) + trimmed.length);
    if (pad) res[0] = 0x00;
    res.set(trimmed, pad ? 1 : 0);
    return res;
  }
  const rD = intToDER(r), sD = intToDER(s);
  const inner = 2 + rD.length + 2 + sD.length;
  const der = new Uint8Array(2 + inner);
  der[0] = 0x30; der[1] = inner;
  der[2] = 0x02; der[3] = rD.length; der.set(rD, 4);
  der[4 + rD.length] = 0x02; der[5 + rD.length] = sD.length; der.set(sD, 6 + rD.length);
  return bytesToBase64(der);
}

// ── Dr. Green API caller ────────────────────────────────────
async function callDrGreenApi(
  method: string, path: string, queryOrBody: string,
  apiKey: string, privateKey: string
): Promise<any> {
  const url = method === 'GET' && queryOrBody
    ? `${DRGREEN_API_URL}${path}?${queryOrBody}` : `${DRGREEN_API_URL}${path}`;
  const dataToSign = queryOrBody || '';
  const signature = await signPayload(dataToSign, privateKey);

  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-auth-apikey': apiKey,
      'x-auth-signature': signature,
    },
  };
  if (method !== 'GET' && queryOrBody) opts.body = queryOrBody;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  opts.signal = controller.signal;

  try {
    const res = await fetch(url, opts);
    clearTimeout(timeout);
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get credentials
    const apiKey = Deno.env.get('DRGREEN_API_KEY');
    const privateKey = Deno.env.get('DRGREEN_PRIVATE_KEY');
    if (!apiKey || !privateKey) {
      return new Response(JSON.stringify({ error: 'API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create service-role Supabase client (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const result = { clients: { fetched: 0, upserted: 0, linked: 0, errors: [] as string[] },
                     orders:  { fetched: 0, upserted: 0, errors: [] as string[] },
                     clientList: [] as any[] };

    // ── 1. Fetch ALL clients from Dr. Green API ──────────────
    let allClients: any[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore && page <= 50) {
      const qs = `orderBy=desc&take=50&page=${page}`;
      const data = await callDrGreenApi('GET', '/dapp/clients', qs, apiKey, privateKey);
      const clients = data?.data?.clients || data?.clients || [];
      if (clients.length === 0) { hasMore = false; break; }
      allClients = [...allClients, ...clients];
      const total = data?.data?.total || data?.total || 0;
      hasMore = allClients.length < total;
      page++;
    }
    result.clients.fetched = allClients.length;

    // Build summary list
    result.clientList = allClients.map((c: any) => ({
      id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName,
      isKYCVerified: c.isKYCVerified, adminApproval: c.adminApproval, isActive: c.isActive,
      country: c.shippings?.[0]?.country || c.phoneCountryCode || 'Unknown',
    }));

    // ── 2. Upsert clients into local DB ──────────────────────
    // Get all auth users by email for linking
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailToUserId: Record<string, string> = {};
    authUsers?.users?.forEach((u: any) => { if (u.email) emailToUserId[u.email.toLowerCase()] = u.id; });

    for (const client of allClients) {
      try {
        const email = (client.email || '').toLowerCase();
        const matchedUserId = emailToUserId[email];
        const countryCode = client.shippings?.[0]?.country || client.phoneCountryCode || 'PT';
        const fullName = `${client.firstName || ''} ${client.lastName || ''}`.trim();

        // Check if already exists
        const { data: existing } = await supabaseAdmin
          .from('drgreen_clients').select('id, user_id')
          .eq('drgreen_client_id', client.id).maybeSingle();

        if (existing) {
          await supabaseAdmin.from('drgreen_clients').update({
            is_kyc_verified: client.isKYCVerified || false,
            admin_approval: client.adminApproval || 'PENDING',
            email, full_name: fullName, country_code: countryCode,
            updated_at: new Date().toISOString(),
            ...(matchedUserId && existing.user_id !== matchedUserId ? { user_id: matchedUserId } : {}),
          }).eq('id', existing.id);
          result.clients.upserted++;
          if (matchedUserId && existing.user_id !== matchedUserId) result.clients.linked++;
        } else if (matchedUserId) {
          // Only insert if we have a local auth user to link to
          await supabaseAdmin.from('drgreen_clients').insert({
            user_id: matchedUserId,
            drgreen_client_id: client.id,
            is_kyc_verified: client.isKYCVerified || false,
            admin_approval: client.adminApproval || 'PENDING',
            email, full_name: fullName, country_code: countryCode,
            shipping_address: client.shippings?.[0] || null,
          });
          result.clients.upserted++;
          result.clients.linked++;
        }
        // Else: external client with no local auth account — skip insert (no user_id to use)
      } catch (err) {
        result.clients.errors.push(`${client.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── 3. Fetch ALL orders from Dr. Green API ───────────────
    let allOrders: any[] = [];
    page = 1; hasMore = true;
    while (hasMore && page <= 50) {
      const qs = `orderBy=desc&take=50&page=${page}`;
      const data = await callDrGreenApi('GET', '/dapp/orders', qs, apiKey, privateKey);
      const orders = data?.data?.orders || data?.orders || [];
      if (orders.length === 0) { hasMore = false; break; }
      allOrders = [...allOrders, ...orders];
      const total = data?.data?.total || data?.total || 0;
      hasMore = allOrders.length < total;
      page++;
    }
    result.orders.fetched = allOrders.length;

    // ── 4. Upsert orders into local DB ───────────────────────
    // Build client-id-to-user mapping for order linking
    const { data: localClients } = await supabaseAdmin
      .from('drgreen_clients').select('drgreen_client_id, user_id');
    const clientToUser: Record<string, string> = {};
    localClients?.forEach((c: any) => { clientToUser[c.drgreen_client_id] = c.user_id; });

    for (const order of allOrders) {
      try {
        const orderId = order.id;
        const clientId = order.clientId || order.client?.id;
        const userId = clientToUser[clientId];
        if (!userId) continue; // Can't insert without user_id

        const { data: existing } = await supabaseAdmin
          .from('drgreen_orders').select('id, status, payment_status')
          .eq('drgreen_order_id', orderId).maybeSingle();

        const status = order.orderStatus || order.status || 'PENDING';
        const paymentStatus = order.paymentStatus || 'PENDING';
        const totalAmount = order.totalAmount || order.totalPrice || 0;

        if (existing) {
          if (existing.status !== status || existing.payment_status !== paymentStatus) {
            await supabaseAdmin.from('drgreen_orders').update({
              status, payment_status: paymentStatus, total_amount: totalAmount,
              synced_at: new Date().toISOString(), sync_status: 'synced',
              updated_at: new Date().toISOString(),
            }).eq('id', existing.id);
          }
          result.orders.upserted++;
        } else {
          await supabaseAdmin.from('drgreen_orders').insert({
            drgreen_order_id: orderId, user_id: userId,
            status, payment_status: paymentStatus, total_amount: totalAmount,
            items: order.items || [], client_id: clientId,
            customer_email: order.client?.email || null,
            customer_name: order.client ? `${order.client.firstName || ''} ${order.client.lastName || ''}`.trim() : null,
            country_code: order.client?.shippings?.[0]?.country || null,
            currency: order.currency || 'EUR',
            synced_at: new Date().toISOString(), sync_status: 'synced',
          });
          result.orders.upserted++;
        }
      } catch (err) {
        result.orders.errors.push(`Order ${order.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return new Response(JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('sync-drgreen-data error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
