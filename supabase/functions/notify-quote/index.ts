// Appends a submitted quote request to the SSG Google Sheet and, when
// Cloud API secrets exist, fans out a WhatsApp alert. The buyer submit
// path is already committed before this runs.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

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
};

const SHEET_HEADERS = [
  'Reference',
  'Time (PKT)',
  'Business',
  'Contact',
  'Identifier',
  'City',
  'Item count',
  'Total PKR',
  'Note',
  'Line items',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const quoteRequestId = await readQuoteRequestId(req);
    if (!quoteRequestId) {
      return json({ error: 'quote_request_id is required' }, 400);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const secretKey = readSecretKey();
    const service = createClient(supabaseUrl, secretKey);

    if (!(await callerMayNotify(req, service, secretKey, quoteRequestId))) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const loaded = await loadQuote(service, quoteRequestId);
    if (!loaded) {
      return json({ error: 'Quote request not found' }, 404);
    }

    const sheetsResult = await appendSheetRow(loaded);
    await writeLog(service, {
      quote_request_id: loaded.request.id,
      channel: 'sheets',
      target: Deno.env.get('GOOGLE_SHEET_ID') ?? null,
      succeeded: sheetsResult.ok,
      error: sheetsResult.error,
    });

    const whatsappResult = await sendWhatsappAlerts(loaded);
    await writeLog(service, {
      quote_request_id: loaded.request.id,
      channel: 'whatsapp',
      target: whatsappResult.target,
      succeeded: whatsappResult.ok,
      error: whatsappResult.error,
    });

    return json({
      sheets: sheetsResult.ok,
      whatsapp: whatsappResult.ok,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'notify-quote failed';
    return json({ error: message }, 500);
  }
});

async function readQuoteRequestId(req: Request): Promise<string | null> {
  const body = (await req.json().catch(() => ({}))) as NotifyBody;
  const fromBody = body.quote_request_id?.trim();
  const fromWebhook = body.record?.id?.trim();
  return fromBody || fromWebhook || null;
}

function readSecretKey(): string {
  const bundled = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (bundled) {
    const parsed = JSON.parse(bundled) as Record<string, string>;
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  throw new Error('Missing SUPABASE_SECRET_KEYS');
}

async function callerMayNotify(
  req: Request,
  service: SupabaseClient,
  secretKey: string,
  quoteRequestId: string
): Promise<boolean> {
  const apiKey = req.headers.get('apikey') ?? '';
  if (apiKey === secretKey) return true;

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return false;

  const { data, error } = await service.auth.getUser(jwt);
  if (error || !data.user) return false;

  const { data: row } = await service
    .from('quote_requests')
    .select('user_id')
    .eq('id', quoteRequestId)
    .maybeSingle();

  return row?.user_id === data.user.id;
}

async function loadQuote(
  service: SupabaseClient,
  quoteRequestId: string
): Promise<{ request: QuoteRequest; items: QuoteItem[]; profile: Profile | null } | null> {
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
  };
}

async function appendSheetRow(loaded: {
  request: QuoteRequest;
  items: QuoteItem[];
  profile: Profile | null;
}): Promise<{ ok: boolean; error: string | null }> {
  try {
    const sheetId = requiredEnv('GOOGLE_SHEET_ID');
    const accessToken = await googleAccessToken();
    const tab = await firstSheetTitle(sheetId, accessToken);
    await ensureHeaderRow(sheetId, tab, accessToken);

    const identifier =
      loaded.profile?.phone ?? loaded.profile?.email ?? '';
    const row = [
      loaded.request.reference,
      formatPkt(loaded.request.created_at),
      loaded.profile?.business_name ?? '',
      loaded.profile?.contact_name ?? '',
      identifier,
      loaded.profile?.city ?? '',
      loaded.request.item_count,
      loaded.request.total_pkr,
      loaded.request.note ?? '',
      flattenItems(loaded.items),
    ];

    const range = `${quoteSheetRange(tab)}!A:J`;
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
        body: JSON.stringify({ values: [row] }),
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

async function sendWhatsappAlerts(loaded: {
  request: QuoteRequest;
  items: QuoteItem[];
  profile: Profile | null;
}): Promise<{ ok: boolean; error: string | null; target: string | null }> {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim();
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')?.trim();
  const template = Deno.env.get('WHATSAPP_TEMPLATE_NAME')?.trim();
  const numbers = (Deno.env.get('SSG_SALES_NUMBERS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!token || !phoneNumberId || !template || numbers.length === 0) {
    return {
      ok: false,
      error: 'whatsapp_not_configured',
      target: numbers.join(',') || null,
    };
  }

  const failures: string[] = [];
  for (const to of numbers) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: template,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: loaded.request.reference },
                  {
                    type: 'text',
                    text: loaded.profile?.business_name ?? 'Buyer',
                  },
                  { type: 'text', text: String(loaded.request.item_count) },
                  { type: 'text', text: String(loaded.request.total_pkr) },
                ],
              },
            ],
          },
        }),
      }
    );
    if (!res.ok) {
      failures.push(`${to}: ${await res.text()}`);
    }
  }

  return {
    ok: failures.length === 0,
    error: failures.length ? failures.join(' | ') : null,
    target: numbers.join(','),
  };
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
  await service.from('notification_log').insert(row);
}

function flattenItems(items: QuoteItem[]): string {
  return items
    .map((item) => {
      const brand = item.brand_snapshot ? ` (${item.brand_snapshot})` : '';
      const oem = item.oem_snapshot ? ` OEM ${item.oem_snapshot}` : '';
      const lineTotal = item.price_snapshot * item.qty;
      return `${item.sku_snapshot} ${item.name_snapshot}${brand}${oem} × ${item.qty} = ${lineTotal}`;
    })
    .join(' • ');
}

function formatPkt(iso: string | null): string {
  const date = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
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

async function firstSheetTitle(
  sheetId: string,
  accessToken: string
): Promise<string> {
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
  const title = data.sheets?.[0]?.properties?.title;
  if (!title) throw new Error('Spreadsheet has no sheets');
  return title;
}

async function ensureHeaderRow(
  sheetId: string,
  tab: string,
  accessToken: string
): Promise<void> {
  const range = `${quoteSheetRange(tab)}!A1:J1`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      range
    )}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Could not read header row: ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  if (data.values?.[0]?.[0]) return;

  const write = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      range
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
