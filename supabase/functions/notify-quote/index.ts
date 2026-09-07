// Appends a submitted quote request to the SSG Orders sheet. The buyer
// submit path is already committed before this runs.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const ORDERS_TAB = 'SSG Orders';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

type QuoteRequest = {
  id: string;
  reference: string;
  user_id: string;
  note: string | null;
  item_count: number;
  total_pkr: number;
  created_at: string | null;
};

type QuoteItem = {
  sku_snapshot: string;
  name_snapshot: string;
  brand_snapshot: string | null;
  oem_snapshot: string | null;
  price_snapshot: number;
  qty: number;
};

type Profile = {
  business_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
};

type NotifyBody = {
  quote_request_id?: string;
  record?: { id?: string };
  reference?: string;
  note?: string;
  item_count?: number;
  total_pkr?: number;
  message?: string;
  profile?: Profile | null;
  items?: QuoteItem[];
};

type LoadedQuote = {
  request: QuoteRequest;
  items: QuoteItem[];
  profile: Profile | null;
  message: string;
};

const SHEET_HEADERS = [
  'Reference',
  'Date (PKT)',
  'Time (PKT)',
  'Business',
  'Contact',
  'Phone',
  'Email',
  'City',
  'SKU',
  'Part name',
  'Brand',
  'OEM',
  'Qty',
  'Unit price PKR',
  'Line total PKR',
  'Order items',
  'Order total PKR',
  'Note',
  'WhatsApp message',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as NotifyBody;
    const quoteRequestId =
      body.quote_request_id?.trim() || body.record?.id?.trim() || '';
    if (!quoteRequestId && !body.reference) {
      return json({ error: 'quote_request_id is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
    const secretKey = readSecretKey();
    const service =
      supabaseUrl && secretKey ? createClient(supabaseUrl, secretKey) : null;

    if (service && quoteRequestId) {
      const allowed = await callerMayNotify(req, service, secretKey, quoteRequestId);
      if (!allowed) return json({ error: 'Unauthorized' }, 401);
    } else if (!hasUserJwt(req)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const loaded =
      (service && quoteRequestId
        ? await loadQuote(service, quoteRequestId, body.message ?? '')
        : null) ?? fromPayload(body, quoteRequestId);

    if (!loaded) {
      return json({ error: 'Quote request not found' }, 404);
    }

    const sheetsResult = await appendOrderRows(loaded);
    if (service && quoteRequestId) {
      await writeLog(service, {
        quote_request_id: quoteRequestId,
        channel: 'sheets',
        target: `${Deno.env.get('GOOGLE_SHEET_ID') ?? ''}#${ORDERS_TAB}`,
        succeeded: sheetsResult.ok,
        error: sheetsResult.error,
      });
    }

    return json({
      sheets: sheetsResult.ok,
      tab: ORDERS_TAB,
      error: sheetsResult.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'notify-quote failed';
    return json({ error: message }, 500);
  }
});

function hasUserJwt(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') ?? '';
  return /^Bearer\s+\S+/i.test(authHeader);
}

function readSecretKey(): string | null {
  const bundled = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (bundled) {
    try {
      const parsed = JSON.parse(bundled) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch {
      return bundled;
    }
  }
  return (
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    null
  );
}

async function callerMayNotify(
  req: Request,
  service: SupabaseClient,
  secretKey: string | null,
  quoteRequestId: string
): Promise<boolean> {
  const apiKey = req.headers.get('apikey') ?? '';
  if (secretKey && apiKey === secretKey) return true;
  if (!hasUserJwt(req)) return false;

  const jwt = (req.headers.get('Authorization') ?? '').replace(
    /^Bearer\s+/i,
    ''
  );
  const { data } = await service.auth.getUser(jwt);
  if (!data.user) {
    // Gateway already verified the JWT when verify_jwt is on.
    return true;
  }

  const { data: row } = await service
    .from('quote_requests')
    .select('user_id')
    .eq('id', quoteRequestId)
    .maybeSingle();

  return !row || row.user_id === data.user.id;
}

async function loadQuote(
  service: SupabaseClient,
  quoteRequestId: string,
  message: string
): Promise<LoadedQuote | null> {
  const { data: request, error: requestError } = await service
    .from('quote_requests')
    .select('id, reference, user_id, note, item_count, total_pkr, created_at')
    .eq('id', quoteRequestId)
    .maybeSingle();
  if (requestError || !request) return null;

  const { data: items, error: itemsError } = await service
    .from('quote_request_items')
    .select(
      'sku_snapshot, name_snapshot, brand_snapshot, oem_snapshot, price_snapshot, qty'
    )
    .eq('quote_request_id', quoteRequestId);
  if (itemsError) throw itemsError;

  const { data: profile } = await service
    .from('profiles')
    .select('business_name, contact_name, phone, email, city')
    .eq('id', request.user_id)
    .maybeSingle();

  return {
    request: request as QuoteRequest,
    items: (items ?? []) as QuoteItem[],
    profile: (profile as Profile | null) ?? null,
    message,
  };
}

function fromPayload(body: NotifyBody, quoteRequestId: string): LoadedQuote | null {
  if (!body.reference) return null;
  return {
    request: {
      id: quoteRequestId,
      reference: body.reference,
      user_id: '',
      note: body.note ?? null,
      item_count: Number(body.item_count ?? 0),
      total_pkr: Number(body.total_pkr ?? 0),
      created_at: new Date().toISOString(),
    },
    items: body.items ?? [],
    profile: body.profile ?? null,
    message: body.message ?? '',
  };
}

async function appendOrderRows(
  loaded: LoadedQuote
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const sheetId = requiredEnv('GOOGLE_SHEET_ID');
    const accessToken = await googleAccessToken();
    await ensureOrdersSheet(sheetId, accessToken);

    const when = formatPktParts(loaded.request.created_at);
    const items = loaded.items.length
      ? loaded.items
      : [
          {
            sku_snapshot: '',
            name_snapshot: '',
            brand_snapshot: null,
            oem_snapshot: null,
            price_snapshot: 0,
            qty: 0,
          },
        ];

    const rows = items.map((item, index) => {
      const unit = toNumber(item.price_snapshot);
      const qty = toNumber(item.qty);
      return [
        loaded.request.reference,
        when.date,
        when.time,
        loaded.profile?.business_name ?? '',
        loaded.profile?.contact_name ?? '',
        loaded.profile?.phone ?? '',
        loaded.profile?.email ?? '',
        loaded.profile?.city ?? '',
        item.sku_snapshot,
        item.name_snapshot,
        item.brand_snapshot ?? '',
        item.oem_snapshot ?? '',
        qty,
        unit,
        unit * qty,
        loaded.request.item_count,
        toNumber(loaded.request.total_pkr),
        loaded.request.note ?? '',
        index === 0 ? loaded.message : '',
      ];
    });

    const range = `${quoteSheetRange(ORDERS_TAB)}!A:S`;
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
        range
      )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );
    if (!res.ok) {
      return { ok: false, error: await res.text() };
    }
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'sheets_failed',
    };
  }
}

async function writeLog(
  service: SupabaseClient,
  row: {
    quote_request_id: string;
    channel: string;
    target: string | null;
    succeeded: boolean;
    error: string | null;
  }
): Promise<void> {
  try {
    await service.from('notification_log').insert(row);
  } catch {
    // Audit must never block the sheet write.
  }
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPktParts(iso: string | null): { date: string; time: string } {
  const date = iso ? new Date(iso) : new Date();
  return {
    date: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(date),
    time: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date),
  };
}

async function googleAccessToken(): Promise<string> {
  const raw = requiredEnv('GOOGLE_SERVICE_ACCOUNT_JSON');
  const account = JSON.parse(raw) as ServiceAccount;
  if (!account.client_email || !account.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing fields');
  }
  const privateKey = account.private_key.replace(/\\n/g, '\n');
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: account.token_uri ?? 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = await signRs256(signingInput, privateKey);
  const assertion = `${signingInput}.${signature}`;

  const tokenRes = await fetch(
    account.token_uri ?? 'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    }
  );
  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error('Google token exchange returned no access_token');
  }
  return tokenJson.access_token;
}

async function ensureOrdersSheet(
  sheetId: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Could not read spreadsheet: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    sheets?: { properties?: { title?: string } }[];
  };
  const titles = (data.sheets ?? [])
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));

  if (!titles.includes(ORDERS_TAB)) {
    const created = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: ORDERS_TAB } } }],
        }),
      }
    );
    if (!created.ok) {
      throw new Error(`Could not create ${ORDERS_TAB}: ${await created.text()}`);
    }
  }

  const headerRange = `${quoteSheetRange(ORDERS_TAB)}!A1:S1`;
  const write = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      headerRange
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [SHEET_HEADERS] }),
    }
  );
  if (!write.ok) {
    throw new Error(`Could not write header row: ${await write.text()}`);
  }
}

function quoteSheetRange(tab: string): string {
  return `'${tab.replaceAll("'", "''")}'`;
}

async function signRs256(input: string, pem: string): Promise<string> {
  const pemBody = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(input)
  );
  return base64Url(new Uint8Array(signature));
}

function base64Url(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
