# Dr. Green DApp API — Full Reference

> **Project:** Healing Buds  
> **Last Updated:** 2026-02-08  
> **Status:** Authoritative reference — all implementation must follow this document  
> **Scope:** Complete API integration covering both auth systems, all endpoints, medical questionnaire, and proxy action mapping

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Two Authentication Systems](#2-two-authentication-systems)
3. [NFT Admin vs Patient (Client)](#3-nft-admin-vs-patient-client)
4. [API Environments & Credentials](#4-api-environments--credentials)
5. [HMAC-SHA256 Signing](#5-hmac-sha256-signing)
6. [Client Endpoints](#6-client-endpoints)
7. [Medical Questionnaire (22 Questions)](#7-medical-questionnaire-22-questions)
8. [Cart Endpoints](#8-cart-endpoints)
9. [Order Endpoints](#9-order-endpoints)
10. [Sales Endpoints](#10-sales-endpoints)
11. [Strain/Product Endpoints](#11-strainproduct-endpoints)
12. [Dashboard & Analytics Endpoints](#12-dashboard--analytics-endpoints)
13. [Proxy Action Mapping (Complete)](#13-proxy-action-mapping-complete)
14. [Error Handling & Status Codes](#14-error-handling--status-codes)
15. [User Flow Diagrams](#15-user-flow-diagrams)
16. [Outstanding Issues & Next Steps](#16-outstanding-issues--next-steps)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      HEALING BUDS FRONTEND                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │  Storefront  │   │ Admin Portal │   │   Patient    │            │
│  │   (Shop)     │   │  (Dashboard) │   │  Dashboard   │            │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘            │
│         └─────────────────┬┴──────────────────┘                    │
│                     ShopContext + WalletContext                      │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                    LOVABLE CLOUD (SUPABASE)                          │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  drgreen-proxy (Edge Function)                                │   │
│  │  • 50+ actions routed via switch statement                    │   │
│  │  • HMAC-SHA256 request signing                                │   │
│  │  • 5 environment credential sets                              │   │
│  │  • Admin/ownership authorization                              │   │
│  │  • Retry with exponential backoff                             │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  wallet-auth (Edge Function)                                    │ │
│  │  • SIWE message verification                                    │ │
│  │  • On-chain NFT ownership check (ERC-721 balanceOf)            │ │
│  │  • Admin role assignment                                        │ │
│  │  • Magic link session creation                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐   │
│  │ drgreen_   │ │ drgreen_   │ │ drgreen_   │ │ strains        │   │
│  │ clients    │ │ cart       │ │ orders     │ │ (product cache)│   │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    DR. GREEN DAPP API                                 │
│               https://api.drgreennft.com/api/v1                      │
│                                                                      │
│  /dapp/clients  │  /dapp/orders  │  /dapp/carts  │  /strains        │
│  /dapp/sales    │  /dapp/users   │  /dapp/nfts   │                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Mandatory Rules

1. **Frontend NEVER calls Dr. Green API directly** — all requests go through `drgreen-proxy`
2. **API keys and secrets are stored server-side only** — in Lovable Cloud secrets
3. **Request signing happens server-side only** — HMAC-SHA256 in edge functions
4. **Error responses are sanitized** — internal details never exposed to client
5. **Logging is sanitized** — keys/signatures truncated in logs

---

## 2. Two Authentication Systems

The Dr. Green ecosystem uses **two completely different authentication systems**:

### System 1: API Key + HMAC Signing (Server-to-Server)

```
Used by:     Our drgreen-proxy edge function
Auth method: x-auth-apikey + x-auth-signature (HMAC-SHA256)
Identity:    Tied to a specific NFT via the API key pair
Scope:       Can only see clients/orders created under THAT NFT's scope
Works for:   /strains (global), /dapp/clients (IF the NFT has operator permissions)
```

**How it works:**
1. API key stored as Base64 string in secrets
2. For GET requests: sign the query string with HMAC-SHA256 using the private key
3. For POST/PATCH/DELETE: sign the JSON body string
4. Send `x-auth-apikey` (raw Base64 key) and `x-auth-signature` (Base64 HMAC output)

### System 2: Wallet-Based DApp Login (Browser Session)

```
Used by:     dapp.drgreennft.com (the Dr. Green admin portal)
Auth method: MetaMask wallet signature → DApp issues a session/JWT
Identity:    Wallet address (0x0b60d85...) which HOLDS the NFT
Scope:       Full access to all data under NFTs owned by that wallet
Works for:   Everything (clients, orders, carts, dashboard)
```

**How it works:**
1. User connects MetaMask wallet
2. Signs a SIWE (Sign-In with Ethereum) message
3. DApp verifies signature and checks on-chain NFT ownership
4. Issues a session token (Bearer JWT or similar)
5. All subsequent API calls use this session token

### Why Client Listing Returns 401

Our proxy uses **System 1** (static API key pairs), which are scoped to a specific NFT instance. These key pairs may not have `/dapp/clients` list permission — they can create clients and list strains, but listing all clients requires operator-level access that may only be available through **System 2** (wallet-based session).

**Status:** Pending investigation — see [Section 16](#16-outstanding-issues--next-steps) for the browser DevTools capture instructions.

---

## 3. NFT Admin vs Patient (Client)

| Property | NFT Admin (Wallet Holder) | Patient (Client) |
|----------|--------------------------|-------------------|
| **Identity** | Wallet address holding Dr. Green NFT | Email + personal details |
| **Auth method** | MetaMask wallet signature (SIWE) | Email/password via Supabase Auth |
| **Access level** | Full dApp: clients, orders, dashboard, analytics | Own profile, shop, cart, orders only |
| **Created via** | Wallet connection + NFT verification | `POST /dapp/clients` with medical record |
| **KYC required** | No (NFT ownership IS the credential) | Yes — `isKYCVerified` + `adminApproval` |
| **Can list all clients** | Yes (via dApp portal or API with correct auth) | No |
| **Can create orders for others** | Yes (admin action) | No (own orders only) |
| **Our system role** | `admin` role in `user_roles` table | No role (default user) |
| **Where they sign in** | `/auth` page via MetaMask → `wallet-auth` edge function | `/auth` page via email/password → Supabase Auth |
| **Session creation** | `wallet-auth` verifies signature + NFT balance → issues OTP → Supabase session | Standard Supabase `signInWithPassword` |

### Eligibility Logic (Non-Negotiable)

A patient is eligible to purchase ONLY if:

```typescript
client.isKYCVerified === true && client.adminApproval === "VERIFIED"
```

If either condition is false:
- Cart must be disabled
- Checkout must be blocked
- User must see a medical verification message

### NFT Admin Authentication Flow

```
1. User clicks "Connect Wallet" on /auth page
2. MetaMask prompts for wallet connection
3. Frontend generates SIWE message:
   "Healing Buds Admin Login\nWallet: 0x...\nTimestamp: 1234567890"
4. MetaMask signs the message
5. Frontend calls wallet-auth edge function with:
   { message, signature, address }
6. wallet-auth:
   a. Recovers address from signature (EIP-191)
   b. Validates timestamp (5-minute window)
   c. Checks on-chain NFT ownership (balanceOf on contract 0x217ddEad61...)
   d. Resolves email via wallet_email_mappings table
   e. Creates/finds Supabase user
   f. Assigns admin role if not already assigned
   g. Returns magic link OTP token
7. Frontend verifies OTP to create Supabase session
8. User is now authenticated as admin
```

### Patient Registration Flow

```
1. User signs up with email/password on /auth page
2. Supabase creates user account
3. User completes medical questionnaire (22 questions)
4. Frontend calls drgreen-proxy with action "create-client-legacy"
5. Proxy signs payload with HMAC-SHA256 and POSTs to /dapp/clients
6. API returns clientId and kycLink
7. User completes KYC verification via kycLink
8. Admin reviews and approves (adminApproval → "VERIFIED")
9. User can now browse products and place orders
```

---

## 4. API Environments & Credentials

### Five Environments

| Environment | Secret Prefix | Purpose | API URL |
|-------------|---------------|---------|---------|
| **Production** | `DRGREEN_` | Live patient data (read) | `api.drgreennft.com` |
| **Alt-Production** | `DRGREEN_ALT_` | Testing on production API | `api.drgreennft.com` |
| **Staging** | `DRGREEN_STAGING_` | Official staging environment | `stage-api.drgreennft.com` |
| **Railway** | (shares staging keys) | Development environment | `budstack-backend-main-development.up.railway.app` |
| **Production-Write** | `DRGREEN_WRITE_` | Client creation + admin reads | `api.drgreennft.com` |

### Credential Auto-Routing

The proxy automatically routes actions to the correct environment:

- **Write actions** (`create-client`, `create-client-legacy`, `admin-reregister-client`, `bootstrap-test-client`) → `production-write`
- **dApp admin reads** (`dashboard-summary`, `dapp-clients`, `dapp-orders`, `sales-summary`, etc.) → `production-write`
- **Product browsing** (`get-strains`, `get-all-strains`) → `production` (or requested env)
- **Everything else** → `production` (or requested env)

### Required Secrets

| Secret Name | Status | Purpose |
|-------------|--------|---------|
| `DRGREEN_API_KEY` | ✅ Configured | Production read API key |
| `DRGREEN_PRIVATE_KEY` | ✅ Configured | Production read signing key |
| `DRGREEN_WRITE_API_KEY` | ✅ Configured | Production write API key |
| `DRGREEN_WRITE_PRIVATE_KEY` | ✅ Configured | Production write signing key |
| `DRGREEN_ALT_API_KEY` | ✅ Configured | Alt-production API key |
| `DRGREEN_ALT_PRIVATE_KEY` | ✅ Configured | Alt-production signing key |
| `DRGREEN_STAGING_API_KEY` | ✅ Configured | Staging API key |
| `DRGREEN_STAGING_PRIVATE_KEY` | ✅ Configured | Staging signing key |
| `DRGREEN_STAGING_API_URL` | ✅ Configured | Staging base URL |
| `ADMIN_WALLET_ADDRESSES` | ✅ Configured | Fallback admin wallets |

---

## 5. HMAC-SHA256 Signing

### Algorithm

| Property | Value |
|----------|-------|
| Algorithm | HMAC-SHA256 (symmetric) |
| Key format | Base64-encoded raw bytes |
| GET signing payload | Query string (e.g., `orderBy=desc&take=10`) |
| POST signing payload | `JSON.stringify(body)` |
| Empty GET payload | `""` (empty string) |
| API key header | `x-auth-apikey` — raw Base64, **no processing** |
| Signature header | `x-auth-signature` — Base64 HMAC output |

### Critical Rules

- ✅ Send the raw `DRGREEN_API_KEY` string exactly as stored — do NOT decode, trim, or process it
- ❌ Do NOT use `extractPemBody()` or strip PEM headers from the API key
- ❌ Do NOT use secp256k1 ECDSA signing (legacy, incorrect)
- ✅ Use `DRGREEN_USE_HMAC !== 'false'` to ensure HMAC mode is active (default)

### Deno Implementation

```typescript
async function signWithHmac(data: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const secret = (secretKey || '').trim();
  
  // Decode Base64 key
  const binaryString = atob(secret);
  const keyBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    keyBytes[i] = binaryString.charCodeAt(i);
  }
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes.buffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  
  const dataBytes = encoder.encode(data);
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, dataBytes);
  
  // Convert to Base64
  const signatureBytes = new Uint8Array(signatureBuffer);
  let binary = '';
  for (let i = 0; i < signatureBytes.byteLength; i++) {
    binary += String.fromCharCode(signatureBytes[i]);
  }
  return btoa(binary);
}
```

---

## 6. Client Endpoints

### POST /dapp/clients — Create a Client

Creates a new client (patient) in the DApp. Clients are created against the primary NFT selected in the dapp.

**Auth:** `x-auth-apikey` + `x-auth-signature` (HMAC-SHA256 of JSON body)  
**Proxy Action:** `create-client-legacy`  
**Environment:** Auto-routed to `production-write`

#### Request Body

```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (required)",
  "phoneCode": "string (required, e.g., +44)",
  "phoneCountryCode": "string (required, e.g., GB)",
  "contactNumber": "string (required)",
  "clientBusiness": {
    "businessType": "string (optional)",
    "name": "string (optional)",
    "address1": "string (optional)",
    "address2": "string (optional)",
    "landmark": "string (optional)",
    "city": "string (optional)",
    "state": "string (optional)",
    "country": "string (optional)",
    "countryCode": "string (optional)",
    "postalCode": "string (optional)"
  },
  "shipping": {
    "address1": "string (required)",
    "address2": "string (optional)",
    "landmark": "string (optional)",
    "city": "string (required)",
    "state": "string (required)",
    "country": "string (required)",
    "countryCode": "string (required, ISO alpha-3, e.g., GBR)",
    "postalCode": "string (required)"
  },
  "medicalRecord": {
    "dob": "string (required, YYYY-MM-DD)",
    "gender": "string (required, e.g., Male, Female)",
    "medicalConditions": ["array (optional)"],
    "otherMedicalCondition": "string (optional)",
    "medicinesTreatments": ["array (optional)"],
    "otherMedicalTreatments": "string (optional)",
    "medicalHistory0": "boolean (required)",
    "medicalHistory1": "boolean (required)",
    "medicalHistory2": "boolean (required)",
    "medicalHistory3": "boolean (required)",
    "medicalHistory4": "boolean (required)",
    "medicalHistory5": ["array of strings (required)"],
    "medicalHistory6": "boolean (optional)",
    "medicalHistory7": ["array of strings (optional)"],
    "medicalHistory7Relation": "string (optional, only if medicalHistory7 != 'none')",
    "medicalHistory8": "boolean (required)",
    "medicalHistory9": "boolean (required)",
    "medicalHistory10": "boolean (required)",
    "medicalHistory11": "string (optional, alcohol units per week)",
    "medicalHistory12": "boolean (required)",
    "medicalHistory13": "string (required, cannabis frequency)",
    "medicalHistory14": ["array of strings (required, cannabis usage methods)"],
    "medicalHistory15": "string (optional, cannabis amount per day)",
    "medicalHistory16": "boolean (optional, cannabis reaction)",
    "prescriptionsSupplements": "string (optional)"
  }
}
```

**Important:** If an optional key has no value, omit the key entirely from the payload.

#### Success Response (201)

```json
{
  "success": true,
  "data": {
    "id": "client-uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "isKYCVerified": false,
    "adminApproval": "PENDING",
    "kycLink": "https://kyc-verification-link.com/...",
    "createdAt": "2026-01-30T00:00:00.000Z"
  }
}
```

### GET /dapp/clients — List All Clients

**Auth:** `x-auth-apikey` + `x-auth-signature` (HMAC-SHA256 of query string)  
**Proxy Action:** `dapp-clients`  
**Environment:** Auto-routed to `production-write`  
**Status:** ⚠️ Returns 401 with all current credential sets — pending investigation

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `orderBy` | string | `desc` | Sort order |
| `take` | number | `10` | Items per page (max 100) |
| `page` | number | `1` | Page number |
| `search` | string | — | Search term |
| `searchBy` | string | `clientName` | Field to search |

### GET /dapp/clients/:clientId — Get Client Details

**Proxy Action:** `dapp-client-details`

### PATCH /dapp/clients/:clientId — Update Client

**Proxy Action:** `patch-client`

### DELETE /dapp/clients/:clientId — Delete Client

**Proxy Action:** `delete-client`

### GET /dapp/clients/summary — Client Summary Stats

**Proxy Action:** `get-clients-summary`

### PATCH /dapp/clients/:clientId/activate — Activate Client

**Proxy Action:** `activate-client`

### PATCH /dapp/clients/:clientId/deactivate — Deactivate Client

**Proxy Action:** `deactivate-client`

---

## 7. Medical Questionnaire (22 Questions)

The medical questionnaire is submitted as part of the `medicalRecord` object in client creation. All option values must match **exactly** as specified below.

### Question Mapping

| # | Field | Question | Type | Required | Options |
|---|-------|----------|------|----------|---------|
| 1 | `medicalConditions` | Select your medical condition(s) | multi-select | Yes | See list below |
| 2 | `otherMedicalCondition` | Other Medical Condition | input | No | Free text |
| 3 | `medicinesTreatments` | Select Prescribed Medicines/Treatments | multi-select | No | See list below |
| 4 | `otherMedicalTreatments` | Other Prescribed Medicines/Treatments | input | No | Free text |
| 5 | `medicalHistory0` | Heart problems history? | radio | Yes | `true` / `false` |
| 6 | `medicalHistory1` | Currently being treated for cancer? | radio | Yes | `true` / `false` |
| 7 | `medicalHistory2` | Taking Immunosuppressants/Immunotherapy? | radio | Yes | `true` / `false` |
| 8 | `medicalHistory3` | History of Liver Disease? | radio | Yes | `true` / `false` |
| 9 | `medicalHistory4` | Referred to psychiatrist? | radio | Yes | `true` / `false` |
| 10 | `medicalHistory5` | Ever diagnosed with? | multi-select | Yes | See list below |
| 11 | `medicalHistory6` | Currently or previously suicidal? | radio | No | `true` / `false` |
| 12 | `medicalHistory7` | Family history conditions? | multi-select | No | See list below |
| 13 | `medicalHistory7Relation` | Relation (if not "None") | input | No | Free text |
| 14 | `medicalHistory8` | History of drug abuse/dependency? | radio | Yes | `true` / `false` |
| 15 | `medicalHistory9` | History of alcohol abuse/dependency? | radio | Yes | `true` / `false` |
| 16 | `medicalHistory10` | Under care of drug/alcohol services? | radio | Yes | `true` / `false` |
| 17 | `medicalHistory11` | Alcohol units per week? | input | Yes* | Free text (number) |
| 18 | `medicalHistory12` | Use cannabis to reduce medications? | radio | Yes | `true` / `false` |
| 19 | `medicalHistory13` | Cannabis usage frequency? | radio | Yes | `"everyday"`, `"every_other_day"`, `"1_2_times_per_week"`, `"never"` |
| 20 | `medicalHistory14` | How have you used cannabis? | multi-select | Yes | See list below |
| 21 | `medicalHistory15` | Cannabis amount per day? | input | No | Free text |
| 22 | `medicalHistory16` | Serious reaction to cannabis? | radio | No | `true` / `false` |
| — | `prescriptionsSupplements` | Current prescriptions/supplements | input | No | Free text |

*Note: `medicalHistory11` is listed as required in the API spec but the proxy treats "0" as omittable.

### Medical Conditions Options (Question 1)

```json
[
  "adhd", "agoraphobia", "anxiety", "appetite_disorders", "arthritis",
  "autistic_spectrum_disorder", "back_and_neck_pain", "bipolar",
  "bladder_pain", "cancer_pain_and_nausea", "chrohns_disease_or_colitis_pain",
  "chronic_and_long_term_pain", "chronic_fatigue_syndrome", "cluster_headaches",
  "complex_regional_pain_syndrome", "depression", "dermatology", "dvt",
  "ehlers-danlos_syndrome", "endometriosis", "epilepsy",
  "female_gynaecological_pain", "fibromyalgia", "irritable_bowel_syndrome",
  "migraine", "multiple_sclerosis_pain_and_muscle_spasm", "nerve_pain",
  "ocd", "osteoporosis", "parkinsons_disease", "personality_disorder",
  "phantom_limb_pain", "post_traumatic_stress_disorder", "sciatica",
  "scoliosis", "sleep_disorders", "spondylolisthesis",
  "thalassemia_major_blood_disorder", "the_menopause", "tinnitus",
  "tourette_syndrome", "trigeminal_neuralgia", "other_medical_condition"
]
```

### Medicines/Treatments Options (Question 3)

```json
[
  "alprazolam", "alfentanil", "amitriptyline", "atomoxetine", "azathioprine",
  "buprenorphine", "bupropion", "citalopram", "clonazepam", "codeine",
  "codeine_phosphate", "co-codamol_30-500", "dexamfetamine", "diazepam",
  "diclofenac", "dihydrocodeine", "fentanyl", "fluoxetine",
  "fluoxetine_prozac", "gabapentin", "guanfacine", "infliximab",
  "lisdexamfetamine", "lithium", "lorazepam", "melatonin",
  "menthylphenidate", "meptazinol", "methadone", "methotrexate",
  "mirtazapine", "modafinil", "morphine", "naproxen", "nefopam",
  "nortriptyline", "omepresol", "omezrapol", "oxycodone", "paroxetine",
  "pentacozine", "pethidine", "prednisolone", "propranolol", "remifentanil",
  "sertraline", "sodium_valproate", "suvorexant", "tapentadol", "temazepam",
  "tramadol", "trazodone", "triazolam", "venlafaxine", "zolpidem",
  "zopiclone", "other_prescribed_medicines_treatments"
]
```

### Diagnosed Conditions Options (Question 10 — `medicalHistory5`)

```json
[
  "anxiety_disorders_including_generalized_anxiety_disorder_ocd_or_other",
  "depression", "mania_bipolar_disorder", "personality_disorder",
  "ptsd", "schizophrenia", "none"
]
```

### Family History Options (Question 12 — `medicalHistory7`)

```json
[
  "psychosis", "schizophrenia", "schizoaffective_disorder",
  "anxiety", "depression", "bipolar_manic_depression_mania", "none"
]
```

### Cannabis Usage Methods (Question 20 — `medicalHistory14`)

```json
[
  "smoking_joints", "vaporizing", "ingestion", "topical", "never"
]
```

---

## 8. Cart Endpoints

### POST /dapp/carts — Add Items to Cart

**Proxy Action:** `add-to-cart`

```json
{
  "clientCartId": "client-uuid",
  "items": [
    {
      "strainId": "strain-uuid",
      "quantity": 2
    }
  ]
}
```

### GET /dapp/carts — List All Carts (Admin)

**Proxy Action:** `dapp-carts`

| Parameter | Type | Description |
|-----------|------|-------------|
| `orderBy` | string | Sort order |
| `take` | number | Items per page |
| `page` | number | Page number |

### GET /dapp/carts/:cartId — Get Specific Cart

**Proxy Action:** `get-cart`

### DELETE /dapp/carts/:clientId — Empty Cart

**Proxy Action:** `empty-cart`

---

## 9. Order Endpoints

### POST /dapp/orders — Create Order

Creates an order from the client's cart items.

**Proxy Action:** `place-order`

```json
{
  "clientId": "client-uuid"
}
```

### Atomic Order Creation (create-order action)

The `create-order` proxy action performs a 3-step atomic flow:
1. Update client shipping address (PATCH `/dapp/clients/:clientId`)
2. Add items to server-side cart (POST `/dapp/carts`)
3. Create order from cart (POST `/dapp/orders`)

**Proxy Action:** `create-order`

```json
{
  "data": {
    "clientId": "client-uuid",
    "items": [
      { "strainId": "strain-uuid", "quantity": 2, "price": 12.50 }
    ],
    "shippingAddress": {
      "address1": "123 Main St",
      "city": "London",
      "state": "England",
      "country": "United Kingdom",
      "countryCode": "GBR",
      "postalCode": "SW1A 1AA"
    }
  }
}
```

### GET /dapp/orders — List All Orders

**Proxy Action:** `dapp-orders`

| Parameter | Type | Description |
|-----------|------|-------------|
| `orderBy` | string | Sort order |
| `take` | number | Items per page |
| `page` | number | Page number |
| `search` | string | Search term |
| `searchBy` | string | Field to search |
| `adminApproval` | string | Filter by status |

### GET /dapp/orders/:orderId — Get Order Details

**Proxy Action:** `dapp-order-details`

### PATCH /dapp/orders/:orderId — Update Order

**Proxy Action:** `dapp-update-order`

```json
{
  "orderStatus": "COMPLETED",
  "paymentStatus": "PAID"
}
```

### GET /dapp/client/:clientId/orders — Get Client's Orders

**Proxy Action:** `get-client-orders`

---

## 10. Sales Endpoints

### GET /dapp/sales — List Sales

**Proxy Action:** `get-sales`

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `take` | number | Items per page |
| `orderBy` | string | Sort order |
| `stage` | string | Filter: `LEADS`, `ONGOING`, `CLOSED` |

### GET /dapp/sales/summary — Sales Summary

**Proxy Action:** `get-sales-summary`

---

## 11. Strain/Product Endpoints

### GET /strains — List Strains (Products)

**Proxy Action:** `get-strains` / `get-all-strains` / `get-strains-legacy`  
**Auth:** Country-gated — open countries (ZAF, THA) bypass auth; restricted (GBR, PRT) require auth

| Parameter | Type | Description |
|-----------|------|-------------|
| `countryCode` | string | ISO alpha-3 country code |
| `orderBy` | string | Sort order |
| `take` | number | Items per page |
| `page` | number | Page number |

### GET /strains/:strainId — Get Strain Details

**Proxy Action:** `get-strain`

---

## 12. Dashboard & Analytics Endpoints

### GET /dapp/dashboard/summary — Dashboard Summary

**Proxy Action:** `dashboard-summary`  
**Environment:** Auto-routed to `production-write`

### GET /dapp/dashboard/analytics — Dashboard Analytics

**Proxy Action:** `dashboard-analytics`

### GET /dapp/users/nfts — Get NFTs

**Proxy Action:** `dapp-nfts` / `get-user-nfts`

---

## 13. Proxy Action Mapping (Complete)

### Public / No Auth Required

| Action | HTTP | Endpoint | Notes |
|--------|------|----------|-------|
| `health-check` | — | Internal | Returns proxy health status |
| `test-staging` | — | Internal | Tests all environment credentials |
| `api-diagnostics` | — | Internal | Comprehensive endpoint testing |
| `debug-compare-keys` | — | Internal | Compare key formats across envs |
| `debug-signing-test` | — | Internal | Test signing methods side by side |

### Country-Gated (Open countries skip auth)

| Action | HTTP | Endpoint | Notes |
|--------|------|----------|-------|
| `get-strains` | GET | `/strains` | By country code |
| `get-all-strains` | GET | `/strains` | All strains, take=100 |
| `get-strains-legacy` | GET | `/strains` | Legacy format |
| `get-strain` | GET | `/strains/:id` | Single strain |

### Auth Only (No ownership check)

| Action | HTTP | Endpoint | Notes |
|--------|------|----------|-------|
| `get-user-me` | GET | (internal) | Get current user |
| `get-client-by-auth-email` | GET | `/dapp/clients` | Search by auth email |

### Ownership-Verified Actions

| Action | HTTP | Endpoint | Notes |
|--------|------|----------|-------|
| `get-client` | GET | `/clients/:id` | Own client record |
| `get-cart` | GET | `/dapp/carts/:id` | Own cart |
| `get-cart-legacy` | GET | `/carts` | Legacy cart format |
| `add-to-cart` | POST | `/dapp/carts` | Add items to own cart |
| `remove-from-cart` | DELETE | `/dapp/carts` | Remove items from cart |
| `empty-cart` | DELETE | `/dapp/carts/:id` | Clear own cart |
| `place-order` | POST | `/dapp/orders` | Create order from cart |
| `create-order` | POST | Multiple | Atomic order creation |
| `get-order` | GET | `/dapp/orders/:id` | Own order |
| `get-orders` | GET | `/dapp/orders` | Own orders |
| `get-my-details` | GET | `/dapp/clients/:id` | Own client details |
| `update-shipping-address` | PATCH | `/dapp/clients/:id` | Own shipping address |

### Authenticated (User creates new resource)

| Action | HTTP | Endpoint | Notes |
|--------|------|----------|-------|
| `create-client` | POST | `/dapp/clients` | New KYC payload format |
| `create-client-legacy` | POST | `/dapp/clients` | Exact API doc format |
| `request-kyc-link` | POST | `/dapp/clients/:id/kyc-link` | Retry KYC link |

### Admin-Only Actions

| Action | HTTP | Endpoint | Notes |
|--------|------|----------|-------|
| `dashboard-summary` | GET | `/dapp/dashboard/summary` | Dashboard stats |
| `dashboard-analytics` | GET | `/dapp/dashboard/analytics` | Analytics data |
| `sales-summary` | GET | (internal) | Computed sales summary |
| `dapp-clients` | GET | `/dapp/clients` | List all clients |
| `dapp-client-details` | GET | `/dapp/clients/:id` | Client details |
| `dapp-verify-client` | PATCH | `/dapp/clients/:id` | Verify client |
| `dapp-orders` | GET | `/dapp/orders` | List all orders |
| `dapp-order-details` | GET | `/dapp/orders/:id` | Order details |
| `dapp-update-order` | PATCH | `/dapp/orders/:id` | Update order status |
| `dapp-carts` | GET | `/dapp/carts` | List all carts |
| `dapp-nfts` | GET | `/dapp/users/nfts` | NFT listing |
| `dapp-strains` | GET | `/strains` | Admin strain listing |
| `dapp-clients-list` | GET | `/dapp/clients/list` | Client list alternative |
| `update-client` | PUT | `/dapp/clients/:id` | Full client update |
| `delete-client` | DELETE | `/dapp/clients/:id` | Delete client |
| `patch-client` | PATCH | `/dapp/clients/:id` | Partial client update |
| `activate-client` | PATCH | `/dapp/clients/:id/activate` | Activate client |
| `deactivate-client` | PATCH | `/dapp/clients/:id/deactivate` | Deactivate client |
| `bulk-delete-clients` | POST | `/dapp/clients/bulk-delete` | Batch delete |
| `admin-list-all-clients` | GET | `/dapp/clients` | Multi-page client fetch |
| `admin-update-shipping-address` | PATCH | `/dapp/clients/:id` | Admin update address |
| `admin-reregister-client` | POST | `/dapp/clients` | Re-register client |
| `get-clients-summary` | GET | `/dapp/clients/summary` | Client stats |
| `get-sales` | GET | `/dapp/sales` | Sales listing |
| `get-sales-summary` | GET | `/dapp/sales/summary` | Sales summary |
| `sync-client-status` | GET | `/dapp/clients/:id` | Sync client verification |
| `sync-client-by-email` | GET | `/dapp/clients` | Find & sync by email |
| `search-clients-drgreen` | GET | `/dapp/clients` | Search clients |
| `admin-search-clients-by-name` | GET | `/dapp/clients` | Search by name |

### Debug Actions (Require debug header)

| Action | HTTP | Endpoint | Notes |
|--------|------|----------|-------|
| `bootstrap-test-client` | POST | `/dapp/clients` | Test client creation |

---

## 14. Error Handling & Status Codes

### Dr. Green API Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Process response |
| 201 | Created | Client/order created |
| 400 | Bad Request | Invalid payload — check field names |
| 401 | Unauthorized | Signature mismatch or invalid API key |
| 403 | Forbidden | Account lacks permission for endpoint |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Email already registered |
| 422 | Unprocessable | Auth works but validation failed |
| 429 | Rate Limited | Back off and retry |
| 500+ | Server Error | Retry with exponential backoff |

### Proxy Error Wrapping

The proxy wraps non-2xx responses in a 200 status with `apiStatus` field:

```json
{
  "success": false,
  "apiStatus": 401,
  "errorCode": "AUTH_FAILED",
  "message": "API authentication failed",
  "retryable": false
}
```

### Retry Configuration

| Operation | Max Retries | Initial Delay | Max Delay |
|-----------|-------------|---------------|-----------|
| GET requests | 3 | 500ms | 5000ms |
| POST requests | 3 | 500ms | 5000ms |
| Retryable codes | — | — | 408, 429, 500, 502, 503, 504 |

---

## 15. User Flow Diagrams

### Patient Registration → Purchase Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Sign Up   │────▶│  Complete   │────▶│   KYC via   │────▶│   Admin     │
│  (Email/    │     │  Medical    │     │  First AML  │     │  Approval   │
│   Password) │     │  Questionnaire│   │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
  Supabase Auth     POST /dapp/clients   External KYC      Manual in DApp
                    (Creates client,     verification      Admin Portal
                     returns kycLink)
                                                                  │
                                              ┌───────────────────┘
                                              ▼
                                    ┌──────────────────┐
                                    │  isKYCVerified &&│
                                    │  adminApproval   │
                                    │  === "VERIFIED"  │
                                    └────────┬─────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Browse Products │
                                    │  Add to Cart     │
                                    │  Checkout        │
                                    │  Place Order     │
                                    └─────────────────┘
```

### NFT Admin Login Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Connect    │────▶│  Sign SIWE  │────▶│  wallet-auth │────▶│  Admin      │
│  MetaMask   │     │  Message    │     │  Edge Func   │     │  Dashboard  │
│             │     │             │     │              │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                    ┌─────────┤
                                    ▼         ▼
                              On-Chain    Assign Admin
                              NFT Check   Role (user_roles)
                              (balanceOf)
```

---

## 16. Outstanding Issues & Next Steps

### Critical: Client Listing Returns 401

**Problem:** All 3 API credential sets return 401 on `GET /dapp/clients`, while `GET /strains` works fine.

**Root Cause (Hypothesis):** Our static API key pairs (System 1) don't have operator-level permissions for the `/dapp/clients` list endpoint. The DApp portal (System 2) uses wallet-based session tokens which carry full NFT owner permissions.

**Resolution Requires:**

1. **Browser DevTools Capture** (Manual step by Ricardo):
   - Sign into `dapp.drgreennft.com` with wallet `0x0b60d85fefcd9064a29f7df0f8cbc7901b9e6c84`
   - Open DevTools → Network tab
   - Navigate to Clients list
   - Capture request headers from any successful `/dapp/clients` call
   - Share: Request URL, all headers (especially `Authorization`, `x-auth-apikey`, `x-auth-signature`), response status

2. **Based on findings, implement one of:**
   - **Option A:** Store the DApp's master API key pair as new secrets
   - **Option B:** Create `drgreen-dapp-session` edge function to replicate wallet login
   - **Option C:** Add wallet address header to proxy requests

### NFT Contract Reference

| Property | Value |
|----------|-------|
| Contract | `0x217ddEad61a42369A266F1Fb754EB5d3EBadc88a` |
| Chain | Ethereum Mainnet |
| Standard | ERC-721 |
| Admin Wallet | `0x0b60d85fefcd9064a29f7df0f8cbc7901b9e6c84` |
| dApp Name | `healingbudscoza` |

### Known Working Endpoints

| Endpoint | Production | Staging | Write |
|----------|-----------|---------|-------|
| `GET /strains` | ✅ | ✅ | ✅ |
| `POST /dapp/clients` | ❓ | ❓ | ❓ |
| `GET /dapp/clients` | ❌ 401 | ❌ 401 | ❌ 401 |
| `GET /dapp/orders` | ❌ 401 | ❌ 401 | ❌ 401 |

### Postman Collection Endpoints (From User)

The user provided a Postman collection confirming the API also supports Bearer token auth:

```
Authorization: Bearer {{bearer_token}}
```

This confirms **Option B** (session-based JWT) is a viable auth mechanism. The DApp likely issues a Bearer token after wallet verification.
