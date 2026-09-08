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
  address: string | null;
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
    const emailResult = await sendOrderEmail(loaded);
    if (service && quoteRequestId) {
      await writeLog(service, {
        quote_request_id: quoteRequestId,
        channel: 'sheets',
        target: `${Deno.env.get('GOOGLE_SHEET_ID') ?? ''}#${ORDERS_TAB}`,
        succeeded: sheetsResult.ok,
        error: sheetsResult.error,
      });
      await writeLog(service, {
        quote_request_id: quoteRequestId,
        channel: 'email',
        target: Deno.env.get('RESEND_TO_EMAIL') ?? null,
        succeeded: emailResult.ok,
        error: emailResult.error,
      });
    }

    return json({
      sheets: sheetsResult.ok,
      email: emailResult.ok,
      tab: ORDERS_TAB,
      error: sheetsResult.error ?? emailResult.error,
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
    .select('business_name, contact_name, phone, email, city, address')
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

async function sendOrderEmail(
  loaded: LoadedQuote
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const apiKey = requiredEnv('RESEND_API_KEY');
    const to = requiredEnv('RESEND_TO_EMAIL');
    const from =
      Deno.env.get('RESEND_FROM')?.trim() ||
      'SSG Auto Parts <onboarding@resend.dev>';
    const pdf = await buildOrderPdf(loaded);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `SSG order ${loaded.request.reference}`,
        html: orderEmailHtml(loaded),
        attachments: [
          {
            filename: `${loaded.request.reference}.pdf`,
            content: pdf,
          },
        ],
      }),
    });
    if (!res.ok) {
      return { ok: false, error: await res.text() };
    }
    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'email_failed',
    };
  }
}

function orderEmailHtml(loaded: LoadedQuote): string {
  const lines = loaded.items
    .map((item) => {
      const unit = toNumber(item.price_snapshot);
      const qty = toNumber(item.qty);
      return `<tr>
        <td>${escapeHtml(item.sku_snapshot)}</td>
        <td>${escapeHtml(item.name_snapshot)}</td>
        <td>${escapeHtml(item.brand_snapshot ?? '')}</td>
        <td>${qty}</td>
        <td>${unit}</td>
        <td>${unit * qty}</td>
      </tr>`;
    })
    .join('');
  return `<h2>SSG Auto Parts — new order</h2>
<p><strong>Reference:</strong> ${escapeHtml(loaded.request.reference)}</p>
<p>
${escapeHtml(loaded.profile?.business_name ?? '')}<br/>
${escapeHtml(loaded.profile?.contact_name ?? '')}<br/>
${escapeHtml(loaded.profile?.phone ?? loaded.profile?.email ?? '')}<br/>
${escapeHtml(loaded.profile?.address ?? '')}<br/>
${escapeHtml(loaded.profile?.city ?? '')}
</p>
<table border="1" cellpadding="6" cellspacing="0">
<tr><th>SKU</th><th>Part</th><th>Brand</th><th>Qty</th><th>Unit</th><th>Line</th></tr>
${lines}
</table>
<p><strong>Items:</strong> ${loaded.request.item_count}<br/>
<strong>Indicative total PKR:</strong> ${toNumber(loaded.request.total_pkr)}</p>
<p>${escapeHtml(loaded.request.note ?? '')}</p>
<p>Prices are indicative. Confirm the final order by phone.</p>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function buildOrderPdf(loaded: LoadedQuote): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = await import(
    'https://esm.sh/pdf-lib@1.17.1'
  );
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const write = (text: string, size = 11, heavy = false) => {
    if (y < 56) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text.slice(0, 90), {
      x: 48,
      y,
      size,
      font: heavy ? bold : font,
      color: rgb(0.1, 0.12, 0.18),
    });
    y -= size + 8;
  };

  write('SSG Auto Parts', 18, true);
  write('Order / quote (indicative)', 11);
  y -= 8;
  write(`Reference: ${loaded.request.reference}`, 12, true);
  write(`Shop: ${loaded.profile?.business_name ?? '-'}`);
  write(`Contact: ${loaded.profile?.contact_name ?? '-'}`);
  write(`Phone: ${loaded.profile?.phone ?? loaded.profile?.email ?? '-'}`);
  write(`Address: ${loaded.profile?.address ?? '-'}`);
  write(`City: ${loaded.profile?.city ?? '-'}`);
  y -= 8;
  write('Parts', 13, true);
  for (const item of loaded.items) {
    const unit = toNumber(item.price_snapshot);
    const qty = toNumber(item.qty);
    write(
      `${item.sku_snapshot}  ${item.name_snapshot}  x${qty}  @ ${unit}  = ${unit * qty}`
    );
  }
  y -= 8;
  write(`Items: ${loaded.request.item_count}`, 12, true);
  write(`Indicative total PKR: ${toNumber(loaded.request.total_pkr)}`, 12, true);
  if (loaded.request.note) write(`Note: ${loaded.request.note}`);
  write('SSG will confirm the final order by phone.');
  return doc.saveAsBase64();
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
