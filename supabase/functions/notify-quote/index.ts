// Appends a submitted quote request to the SSG Orders sheet. The buyer
// submit path is already committed before this runs.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';
import { SSG_LOGO_PNG_BASE64 } from './ssg-logo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
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
  'Status',
  'Business',
  'Contact',
  'Phone',
  'Email',
  'City',
  'Address',
  'Line items',
  'Total items',
  'Order total PKR',
  'Note',
  'Quote PDF',
];

const QUOTE_PDF_BUCKET = 'order-quotes';

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
    } else if (!hasUserJwt(req) && !isTrustedApiKey(req, secretKey)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const run = deliverQuote(service, quoteRequestId, body);
    if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
      EdgeRuntime.waitUntil(
        run.catch((error) => {
          console.error(
            'notify-quote background failed',
            error instanceof Error ? error.message : error
          );
        })
      );
      return json({ accepted: true });
    }

    const result = await run;
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'notify-quote failed';
    return json({ error: message }, 500);
  }
});

async function deliverQuote(
  service: SupabaseClient | null,
  quoteRequestId: string,
  body: NotifyBody
): Promise<{
  sheets: boolean;
  email: boolean;
  tab: string;
  error: string | null;
}> {
  const loaded =
    (service && quoteRequestId
      ? await loadQuote(service, quoteRequestId, body.message ?? '')
      : null) ?? fromPayload(body, quoteRequestId);

  if (!loaded) {
    throw new Error('Quote request not found');
  }

  const totals = summarizeItems(loaded.items);
  const quote: LoadedQuote = {
    ...loaded,
    request: {
      ...loaded.request,
      item_count:
        totals.qty > 0 ? totals.qty : toNumber(loaded.request.item_count),
      total_pkr:
        totals.totalPkr > 0
          ? totals.totalPkr
          : toNumber(loaded.request.total_pkr),
    },
  };

  let pdf: string | null = null;
  try {
    pdf = await buildOrderPdf(quote);
  } catch (error) {
    console.error(
      'quote pdf failed',
      error instanceof Error ? error.message : error
    );
    try {
      pdf = await buildOrderPdf(quote);
    } catch {
      pdf = null;
    }
  }
  const alreadyEmailed = await alreadyLogged(service, quote.request.id, 'email');
  const pdfUrl = await storeOrderPdf(service, quote.request.reference, pdf);
  const sheetsResult = await appendOrderRows(quote, pdfUrl);
  const emailResult = alreadyEmailed
    ? { ok: true, error: null }
    : await sendOrderEmail(quote, pdf);
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

  return {
    sheets: sheetsResult.ok,
    email: emailResult.ok,
    tab: ORDERS_TAB,
    error: sheetsResult.error ?? emailResult.error,
  };
}

function hasUserJwt(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') ?? '';
  return /^Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\./.test(authHeader);
}

function requestApiKey(req: Request): string {
  return req.headers.get('apikey') ?? '';
}

function readAnonKey(): string | null {
  const anon = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (anon) return anon;
  const bundled = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (!bundled) return null;
  try {
    const parsed = JSON.parse(bundled) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0] ?? null;
  } catch {
    return bundled;
  }
}

function isTrustedApiKey(req: Request, secretKey: string | null): boolean {
  const apiKey = requestApiKey(req);
  if (!apiKey) return false;
  if (secretKey && apiKey === secretKey) return true;
  const anon = readAnonKey();
  return Boolean(anon && apiKey === anon);
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
  if (isTrustedApiKey(req, secretKey)) return true;
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

  const { data: profile } = await service
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profile?.role === 'admin' && profile.status === 'active') {
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

  let { data: items, error: itemsError } = await service
    .from('quote_request_items')
    .select(
      'sku_snapshot, name_snapshot, brand_snapshot, oem_snapshot, price_snapshot, qty'
    )
    .eq('quote_request_id', quoteRequestId);
  if (itemsError) throw itemsError;
  if (!items?.length) {
    for (let attempt = 0; attempt < 5 && !items?.length; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const retry = await service
        .from('quote_request_items')
        .select(
          'sku_snapshot, name_snapshot, brand_snapshot, oem_snapshot, price_snapshot, qty'
        )
        .eq('quote_request_id', quoteRequestId);
      if (retry.error) throw retry.error;
      items = retry.data;
    }
  }

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
  loaded: LoadedQuote,
  pdfUrl: string | null
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const sheetId = requiredEnv('GOOGLE_SHEET_ID');
    const accessToken = await googleAccessToken();
    await ensureOrdersSheet(sheetId, accessToken);

    const when = formatPktParts(loaded.request.created_at);
    const totals = summarizeItems(loaded.items);
    const existingRow = await sheetRowForReference(
      sheetId,
      accessToken,
      loaded.request.reference
    );
    if (existingRow) {
      if (pdfUrl) {
        await updateSheetPdfCell(sheetId, accessToken, existingRow, pdfUrl);
      }
      return { ok: true, error: null };
    }
    const pdfCell = pdfUrl
      ? `=HYPERLINK("${pdfUrl.replaceAll('"', '')}","Open quote PDF")`
      : '';
    const rows = [
      [
        loaded.request.reference,
        `'${when.date}`,
        `'${when.time}`,
        'New',
        loaded.profile?.business_name ?? '',
        loaded.profile?.contact_name ?? '',
        loaded.profile?.phone ?? '',
        loaded.profile?.email ?? '',
        loaded.profile?.city ?? '',
        loaded.profile?.address ?? '',
        totals.lines,
        totals.qty || loaded.request.item_count,
        toNumber(loaded.request.total_pkr),
        loaded.request.note ?? '',
        pdfCell,
      ],
    ];

    const range = `${quoteSheetRange(ORDERS_TAB)}!A:O`;
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

async function alreadyLogged(
  service: SupabaseClient | null,
  quoteRequestId: string,
  channel: string
): Promise<boolean> {
  if (!service || !quoteRequestId) return false;
  const { data } = await service
    .from('notification_log')
    .select('id')
    .eq('quote_request_id', quoteRequestId)
    .eq('channel', channel)
    .eq('succeeded', true)
    .limit(1);
  return Boolean(data?.length);
}

async function sheetRowForReference(
  sheetId: string,
  accessToken: string,
  reference: string
): Promise<number | null> {
  if (!reference) return null;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      `${quoteSheetRange(ORDERS_TAB)}!A:A`
    )}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { values?: string[][] };
  const index = (json.values ?? []).findIndex((row) => row[0] === reference);
  return index >= 0 ? index + 1 : null;
}

async function updateSheetPdfCell(
  sheetId: string,
  accessToken: string,
  row: number,
  pdfUrl: string
): Promise<void> {
  const pdfCell = `=HYPERLINK("${pdfUrl.replaceAll('"', '')}","Open quote PDF")`;
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      `${quoteSheetRange(ORDERS_TAB)}!O${row}`
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [[pdfCell]] }),
    }
  );
}

async function storeOrderPdf(
  service: SupabaseClient | null,
  reference: string,
  pdf: string | null
): Promise<string | null> {
  if (!service || !pdf || !reference) return null;
  try {
    const created = await service.storage.createBucket(QUOTE_PDF_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['application/pdf'],
    });
    if (created.error && /already exists/i.test(created.error.message)) {
      await service.storage.updateBucket(QUOTE_PDF_BUCKET, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: ['application/pdf'],
      });
    }
    const path = `${reference.replaceAll('/', '-')}.pdf`;
    const bytes = decodeBase64(pdf);
    const { error } = await service.storage.from(QUOTE_PDF_BUCKET).upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: true,
    });
    if (error) {
      console.error('quote pdf upload failed', error.message);
      return null;
    }
    const { data } = service.storage.from(QUOTE_PDF_BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch (error) {
    console.error(
      'quote pdf store failed',
      error instanceof Error ? error.message : error
    );
    return null;
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
  loaded: LoadedQuote,
  pdf: string | null
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const apiKey = requiredEnv('RESEND_API_KEY');
    const to = requiredEnv('RESEND_TO_EMAIL');
    const from =
      Deno.env.get('RESEND_FROM')?.trim() ||
      'SSG Auto Parts <onboarding@resend.dev>';
    const attachments: Record<string, unknown>[] = [];
    if (pdf) {
      attachments.push({
        filename: `${loaded.request.reference}.pdf`,
        content: pdf,
      });
    }
    const payload: Record<string, unknown> = {
      from,
      to: [to],
      subject: `New SSG order from ${buyerLabel(loaded)} — ${loaded.request.reference}`,
      html: orderEmailHtml(loaded),
      attachments,
    };
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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

function buyerLabel(loaded: LoadedQuote): string {
  return (
    loaded.profile?.business_name?.trim() ||
    loaded.profile?.contact_name?.trim() ||
    loaded.profile?.email?.trim() ||
    'a registered buyer'
  );
}

function orderEmailHtml(loaded: LoadedQuote): string {
  const shop = escapeHtml(buyerLabel(loaded));
  const contact = escapeHtml(loaded.profile?.contact_name?.trim() ?? '');
  const city = escapeHtml(loaded.profile?.city?.trim() ?? '');
  const who =
    contact && contact !== shop
      ? `${shop} (${contact}${city ? `, ${city}` : ''})`
      : `${shop}${city ? ` in ${city}` : ''}`;
  const totals = summarizeItems(loaded.items);
  const when = formatPktParts(loaded.request.created_at);
  const note = escapeHtml(loaded.request.note?.trim() || '—');
  const lineRows = loaded.items
    .map((item, index) => {
      const unit = toNumber(item.price_snapshot);
      const qty = toNumber(item.qty);
      return `<tr>
        <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280;">${index + 1}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.sku_snapshot || '—')}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name_snapshot || '—')}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.brand_snapshot || '—')}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.oem_snapshot || '—')}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;">${qty}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">${escapeHtml(formatPkrDisplay(unit))}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">${escapeHtml(formatPkrDisplay(unit * qty))}</td>
      </tr>`;
    })
    .join('');
  const th =
    'padding:8px 6px;background:#1B2C5B;color:#ffffff;font-size:11px;text-align:left;';
  const thRight = `${th}text-align:right;`;
  return `<!DOCTYPE html>
<html>
<body style="margin:0;background:#f3f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="background:#1B2C5B;padding:20px 24px;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.3px;">SSG Auto Parts</p>
              <p style="margin:10px 0 0;color:#C2CDE3;font-size:12px;letter-spacing:0.4px;">Trusted since 1971</p>
            </td>
          </tr>
          <tr><td style="height:4px;background:#C8102E;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:28px 24px 32px;color:#1B2C5B;">
              <p style="margin:0 0 12px;font-size:18px;font-weight:bold;">New order received</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#2c3340;">
                An order has been received from <strong>${who}</strong>.
                Please review the quote below and confirm the final order by phone.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;margin:0 0 18px;font-size:13px;color:#2c3340;">
                <tr>
                  <td style="padding:8px 10px;background:#f8f9fb;width:22%;color:#6b7280;">Reference</td>
                  <td style="padding:8px 10px;font-weight:bold;">${escapeHtml(loaded.request.reference)}</td>
                  <td style="padding:8px 10px;background:#f8f9fb;width:22%;color:#6b7280;">Date (PKT)</td>
                  <td style="padding:8px 10px;">${escapeHtml(`${when.date} ${when.time}`)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 10px;background:#f8f9fb;color:#6b7280;">Business</td>
                  <td style="padding:8px 10px;">${escapeHtml(dash(loaded.profile?.business_name))}</td>
                  <td style="padding:8px 10px;background:#f8f9fb;color:#6b7280;">Contact</td>
                  <td style="padding:8px 10px;">${escapeHtml(dash(loaded.profile?.contact_name))}</td>
                </tr>
                <tr>
                  <td style="padding:8px 10px;background:#f8f9fb;color:#6b7280;">Phone</td>
                  <td style="padding:8px 10px;">${escapeHtml(dash(loaded.profile?.phone))}</td>
                  <td style="padding:8px 10px;background:#f8f9fb;color:#6b7280;">Email</td>
                  <td style="padding:8px 10px;">${escapeHtml(dash(loaded.profile?.email))}</td>
                </tr>
                <tr>
                  <td style="padding:8px 10px;background:#f8f9fb;color:#6b7280;">City</td>
                  <td style="padding:8px 10px;">${escapeHtml(dash(loaded.profile?.city))}</td>
                  <td style="padding:8px 10px;background:#f8f9fb;color:#6b7280;">Address</td>
                  <td style="padding:8px 10px;">${escapeHtml(dash(loaded.profile?.address))}</td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;color:#2c3340;">
                <tr>
                  <th style="${thRight}">#</th>
                  <th style="${th}">SKU</th>
                  <th style="${th}">Part name</th>
                  <th style="${th}">Brand</th>
                  <th style="${th}">OEM</th>
                  <th style="${thRight}">Qty</th>
                  <th style="${thRight}">Unit</th>
                  <th style="${thRight}">Line</th>
                </tr>
                ${lineRows}
                <tr>
                  <td colspan="5" style="padding:10px 6px;text-align:right;color:#6b7280;">Line items / total qty</td>
                  <td style="padding:10px 6px;text-align:right;font-weight:bold;">${totals.lines} / ${totals.qty}</td>
                  <td style="padding:10px 6px;text-align:right;color:#6b7280;">Indicative total</td>
                  <td style="padding:10px 6px;text-align:right;font-weight:bold;color:#C8102E;white-space:nowrap;">${escapeHtml(formatPkrDisplay(totals.totalPkr))}</td>
                </tr>
                <tr>
                  <td colspan="8" style="padding:10px 8px;background:#fff8f0;border-top:1px solid #e5e7eb;">
                    <strong style="color:#1B2C5B;">Buyer comments</strong><br/>
                    ${note}
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:12px;color:#6b7280;">SSG Auto Parts · Prices are indicative. A PDF copy is attached.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

type PdfFont = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

type PdfRgb = unknown;

type PdfImage = unknown;

type PdfPage = {
  drawRectangle: (opts: Record<string, unknown>) => void;
  drawText: (text: string, opts: Record<string, unknown>) => void;
  drawImage: (image: PdfImage, opts: Record<string, unknown>) => void;
};

type PdfAlign = 'left' | 'right' | 'center';

function cellBaseline(cellBottom: number, cellHeight: number, fontSize: number): number {
  const capHeight = fontSize * 0.72;
  return cellBottom + (cellHeight - capHeight) / 2;
}

function drawAlignedText(
  page: PdfPage,
  text: string,
  opts: {
    x: number;
    width: number;
    cellBottom: number;
    cellHeight: number;
    size: number;
    font: PdfFont;
    color: PdfRgb;
    align: PdfAlign;
    pad?: number;
  }
): void {
  const pad = opts.pad ?? 6;
  const widthOf = opts.font.widthOfTextAtSize(text, opts.size);
  let textX = opts.x + pad;
  if (opts.align === 'right') textX = opts.x + opts.width - pad - widthOf;
  if (opts.align === 'center') textX = opts.x + Math.max(0, (opts.width - widthOf) / 2);
  page.drawText(text, {
    x: textX,
    y: cellBaseline(opts.cellBottom, opts.cellHeight, opts.size),
    size: opts.size,
    font: opts.font,
    color: opts.color,
  });
}

function drawWrappedInCell(
  page: PdfPage,
  lines: string[],
  opts: {
    x: number;
    width: number;
    cellBottom: number;
    cellHeight: number;
    size: number;
    font: PdfFont;
    color: PdfRgb;
    align: PdfAlign;
    lineHeight: number;
    pad?: number;
  }
): void {
  if (lines.length <= 1) {
    drawAlignedText(page, lines[0] ?? '', opts);
    return;
  }
  const capHeight = opts.size * 0.72;
  const blockHeight = (lines.length - 1) * opts.lineHeight + capHeight;
  const firstBaseline =
    opts.cellBottom + (opts.cellHeight - blockHeight) / 2 + (lines.length - 1) * opts.lineHeight;
  const pad = opts.pad ?? 6;
  lines.forEach((line, index) => {
    const widthOf = opts.font.widthOfTextAtSize(line, opts.size);
    let textX = opts.x + pad;
    if (opts.align === 'right') textX = opts.x + opts.width - pad - widthOf;
    if (opts.align === 'center') textX = opts.x + Math.max(0, (opts.width - widthOf) / 2);
    page.drawText(line, {
      x: textX,
      y: firstBaseline - index * opts.lineHeight,
      size: opts.size,
      font: opts.font,
      color: opts.color,
    });
  });
}

async function buildOrderPdf(loaded: LoadedQuote): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = await import(
    'https://esm.sh/pdf-lib@1.17.1'
  );
  const doc = await PDFDocument.create();
  const font = (await doc.embedFont(StandardFonts.Helvetica)) as PdfFont;
  const bold = (await doc.embedFont(StandardFonts.HelveticaBold)) as PdfFont;
  let logo: PdfImage | null = null;
  try {
    logo = await doc.embedPng(decodeBase64(SSG_LOGO_PNG_BASE64));
  } catch {
    logo = null;
  }

  const navy = rgb(0.106, 0.173, 0.357);
  const red = rgb(0.784, 0.063, 0.18);
  const ink = rgb(0.12, 0.14, 0.2);
  const muted = rgb(0.38, 0.42, 0.5);
  const rule = rgb(0.82, 0.84, 0.88);
  const zebra = rgb(0.965, 0.97, 0.98);
  const white = rgb(1, 1, 1);
  const headerFill = rgb(0.106, 0.173, 0.357);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 36;
  const tableWidth = pageWidth - margin * 2;
  const totals = summarizeItems(loaded.items);
  const when = formatPktParts(loaded.request.created_at);
  const note = loaded.request.note?.trim() || '—';

  let page = doc.addPage([pageWidth, pageHeight]) as PdfPage;
  let y = pageHeight;

  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]) as PdfPage;
    y = pageHeight - 40;
  };

  const ensure = (needed: number) => {
    if (y - needed < 48) newPage();
  };

  const headerHeight = 72;
  const headerBottom = pageHeight - headerHeight;
  const drawHeader = () => {
    page.drawRectangle({
      x: 0,
      y: headerBottom,
      width: pageWidth,
      height: headerHeight,
      color: navy,
    });
    page.drawRectangle({
      x: 0,
      y: headerBottom - 4,
      width: pageWidth,
      height: 4,
      color: red,
    });
    if (logo && typeof logo === 'object' && 'width' in logo && 'height' in logo) {
      const image = logo as { width: number; height: number };
      const height = 34;
      const width = (image.width / image.height) * height;
      page.drawImage(logo, {
        x: margin,
        y: headerBottom + (headerHeight - height) / 2,
        width,
        height,
      });
    } else {
      drawAlignedText(page, 'SSG Auto Parts', {
        x: margin,
        width: 220,
        cellBottom: headerBottom,
        cellHeight: headerHeight,
        size: 18,
        font: bold,
        color: white,
        align: 'left',
      });
    }
    drawAlignedText(page, 'Trusted since 1971', {
      x: pageWidth - margin - 130,
      width: 130,
      cellBottom: headerBottom,
      cellHeight: headerHeight,
      size: 10,
      font,
      color: rgb(0.76, 0.8, 0.89),
      align: 'right',
    });
    y = headerBottom - 28;
  };

  drawHeader();

  const titleSize = 14;
  const titleHeight = 20;
  const titleBottom = y - titleHeight;
  drawAlignedText(page, 'Quote sheet', {
    x: margin,
    width: 220,
    cellBottom: titleBottom,
    cellHeight: titleHeight,
    size: titleSize,
    font: bold,
    color: navy,
    align: 'left',
  });
  drawAlignedText(page, loaded.request.reference, {
    x: pageWidth - margin - 180,
    width: 180,
    cellBottom: titleBottom,
    cellHeight: titleHeight,
    size: titleSize,
    font: bold,
    color: red,
    align: 'right',
  });
  y = titleBottom - 2;
  const disclaimerHeight = 14;
  drawAlignedText(page, 'Indicative prices. SSG will confirm the final order by phone.', {
    x: margin,
    width: tableWidth,
    cellBottom: y - disclaimerHeight,
    cellHeight: disclaimerHeight,
    size: 9,
    font,
    color: muted,
    align: 'left',
    pad: 0,
  });
  y -= disclaimerHeight + 10;

  const buyerRows: [string, string][] = [
    ['Business', dash(loaded.profile?.business_name)],
    ['Contact', dash(loaded.profile?.contact_name)],
    ['Phone', dash(loaded.profile?.phone)],
    ['Email', dash(loaded.profile?.email)],
    ['City', dash(loaded.profile?.city)],
    ['Address', dash(loaded.profile?.address)],
    ['Date (PKT)', `${when.date}  ${when.time}`],
    ['Reference', loaded.request.reference],
  ];

  y = drawKeyValueTable(page, {
    x: margin,
    y,
    width: tableWidth,
    rows: buyerRows,
    font,
    bold,
    ink,
    muted,
    rule,
    zebra,
    paper: white,
    labelFill: rgb(0.93, 0.94, 0.96),
    ensure,
  });
  y -= 16;

  const sectionHeight = 18;
  drawAlignedText(page, 'Order details', {
    x: margin,
    width: tableWidth,
    cellBottom: y - sectionHeight,
    cellHeight: sectionHeight,
    size: 13,
    font: bold,
    color: navy,
    align: 'left',
    pad: 0,
  });
  y -= sectionHeight + 6;

  const columns: PdfColumn[] = [
    { key: '#', width: 22, align: 'center' },
    { key: 'SKU', width: 68, align: 'left' },
    { key: 'Part name', width: 128, align: 'left' },
    { key: 'Brand', width: 68, align: 'left' },
    { key: 'OEM', width: 68, align: 'left' },
    { key: 'Qty', width: 32, align: 'right' },
    { key: 'Unit PKR', width: 68, align: 'right' },
    { key: 'Line PKR', width: 69, align: 'right' },
  ];

  const itemHeaderHeight = 22;
  const drawItemsHeader = () => {
    ensure(itemHeaderHeight + 4);
    const cellBottom = y - itemHeaderHeight;
    drawRowBackground(page, margin, cellBottom, tableWidth, itemHeaderHeight, headerFill);
    let x = margin;
    for (const column of columns) {
      drawAlignedText(page, column.key, {
        x,
        width: column.width,
        cellBottom,
        cellHeight: itemHeaderHeight,
        size: 8,
        font: bold,
        color: white,
        align: column.align,
        pad: 5,
      });
      x += column.width;
    }
    y = cellBottom;
  };

  drawItemsHeader();

  const items = loaded.items.length
    ? loaded.items
    : [
        {
          sku_snapshot: '',
          name_snapshot: 'No line items',
          brand_snapshot: null,
          oem_snapshot: null,
          price_snapshot: 0,
          qty: 0,
        },
      ];

  items.forEach((item, index) => {
    const unit = toNumber(item.price_snapshot);
    const qty = toNumber(item.qty);
    const values = [
      String(index + 1),
      item.sku_snapshot || '—',
      item.name_snapshot || '—',
      item.brand_snapshot || '—',
      item.oem_snapshot || '—',
      String(qty),
      formatPkrDisplay(unit),
      formatPkrDisplay(unit * qty),
    ];
    const wrapped = columns.map((column, colIndex) =>
      wrapCell(values[colIndex] ?? '', font, 8, column.width - 12)
    );
    const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
    const lineHeight = 11;
    const rowHeight = Math.max(22, lineCount * lineHeight + 8);
    if (y - rowHeight < 48) {
      newPage();
      drawItemsHeader();
    }
    const cellBottom = y - rowHeight;
    if (index % 2 === 0) {
      drawRowBackground(page, margin, cellBottom, tableWidth, rowHeight, zebra);
    }
    let x = margin;
    columns.forEach((column, colIndex) => {
      drawWrappedInCell(page, wrapped[colIndex], {
        x,
        width: column.width,
        cellBottom,
        cellHeight: rowHeight,
        size: 8,
        font,
        color: ink,
        align: column.align,
        lineHeight,
        pad: 5,
      });
      x += column.width;
    });
    y = cellBottom;
  });

  y -= 12;
  ensure(76);
  const summary = [
    ['Line items', String(totals.lines)],
    ['Total quantity', String(totals.qty)],
    ['Indicative total', formatPkrDisplay(totals.totalPkr || toNumber(loaded.request.total_pkr))],
  ];
  const boxWidth = 220;
  const boxX = pageWidth - margin - boxWidth;
  const summaryRowHeight = 18;
  const boxHeight = summary.length * summaryRowHeight + 10;
  const boxBottom = y - boxHeight;
  page.drawRectangle({
    x: boxX,
    y: boxBottom,
    width: boxWidth,
    height: boxHeight,
    color: zebra,
    borderColor: rule,
    borderWidth: 0.6,
  });
  summary.forEach((row, index) => {
    const cellBottom = boxBottom + (summary.length - 1 - index) * summaryRowHeight + 5;
    drawAlignedText(page, row[0], {
      x: boxX,
      width: boxWidth * 0.55,
      cellBottom,
      cellHeight: summaryRowHeight,
      size: 9,
      font,
      color: muted,
      align: 'left',
      pad: 10,
    });
    drawAlignedText(page, row[1], {
      x: boxX + boxWidth * 0.4,
      width: boxWidth * 0.6,
      cellBottom,
      cellHeight: summaryRowHeight,
      size: 10,
      font: bold,
      color: index === 2 ? red : navy,
      align: 'right',
      pad: 10,
    });
  });
  y = boxBottom - 16;

  ensure(56);
  const commentsTitleHeight = 16;
  drawAlignedText(page, 'Buyer comments', {
    x: margin,
    width: tableWidth,
    cellBottom: y - commentsTitleHeight,
    cellHeight: commentsTitleHeight,
    size: 11,
    font: bold,
    color: navy,
    align: 'left',
    pad: 0,
  });
  y -= commentsTitleHeight + 6;
  const commentLineHeight = 12;
  const commentLines = wrapCell(note, font, 9, tableWidth - 16);
  const commentHeight = Math.max(26, commentLines.length * commentLineHeight + 12);
  ensure(commentHeight + 8);
  const commentBottom = y - commentHeight;
  page.drawRectangle({
    x: margin,
    y: commentBottom,
    width: tableWidth,
    height: commentHeight,
    color: rgb(1, 0.984, 0.96),
    borderColor: rule,
    borderWidth: 0.6,
  });
  drawWrappedInCell(page, commentLines, {
    x: margin,
    width: tableWidth,
    cellBottom: commentBottom,
    cellHeight: commentHeight,
    size: 9,
    font,
    color: ink,
    align: 'left',
    lineHeight: commentLineHeight,
    pad: 8,
  });

  return doc.saveAsBase64();
}

type PdfColumn = {
  key: string;
  width: number;
  align: PdfAlign;
};

function drawRowBackground(
  page: PdfPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: PdfRgb
): void {
  page.drawRectangle({ x, y, width, height, color });
}

function drawKeyValueTable(
  page: PdfPage,
  opts: {
    x: number;
    y: number;
    width: number;
    rows: [string, string][];
    font: PdfFont;
    bold: PdfFont;
    ink: PdfRgb;
    muted: PdfRgb;
    rule: PdfRgb;
    zebra: PdfRgb;
    paper: PdfRgb;
    labelFill: PdfRgb;
    ensure: (needed: number) => void;
  }
): number {
  const colWidth = opts.width / 2;
  const labelWidth = 78;
  const lineHeight = 11;
  let y = opts.y;
  for (let index = 0; index < opts.rows.length; index += 2) {
    const left = opts.rows[index];
    const right = opts.rows[index + 1];
    const valueWidth = colWidth - labelWidth - 14;
    const leftLines = wrapCell(left[1], opts.font, 9, valueWidth);
    const rightLines = right ? wrapCell(right[1], opts.font, 9, valueWidth) : [''];
    const height = Math.max(22, Math.max(leftLines.length, rightLines.length) * lineHeight + 10);
    opts.ensure(height);
    const cellBottom = y - height;
    drawRowBackground(
      page,
      opts.x,
      cellBottom,
      opts.width,
      height,
      index % 4 === 0 ? opts.zebra : opts.paper
    );
    drawRowBackground(page, opts.x, cellBottom, labelWidth, height, opts.labelFill);
    if (right) {
      drawRowBackground(page, opts.x + colWidth, cellBottom, labelWidth, height, opts.labelFill);
    }
    drawAlignedText(page, left[0], {
      x: opts.x,
      width: labelWidth,
      cellBottom,
      cellHeight: height,
      size: 8,
      font: opts.bold,
      color: opts.muted,
      align: 'left',
      pad: 8,
    });
    drawWrappedInCell(page, leftLines, {
      x: opts.x + labelWidth,
      width: colWidth - labelWidth,
      cellBottom,
      cellHeight: height,
      size: 9,
      font: opts.font,
      color: opts.ink,
      align: 'left',
      lineHeight,
      pad: 8,
    });
    if (right) {
      drawAlignedText(page, right[0], {
        x: opts.x + colWidth,
        width: labelWidth,
        cellBottom,
        cellHeight: height,
        size: 8,
        font: opts.bold,
        color: opts.muted,
        align: 'left',
        pad: 8,
      });
      drawWrappedInCell(page, rightLines, {
        x: opts.x + colWidth + labelWidth,
        width: colWidth - labelWidth,
        cellBottom,
        cellHeight: height,
        size: 9,
        font: opts.font,
        color: opts.ink,
        align: 'left',
        lineHeight,
        pad: 8,
      });
    }
    y = cellBottom;
  }
  page.drawRectangle({
    x: opts.x,
    y,
    width: opts.width,
    height: opts.y - y,
    borderColor: opts.rule,
    borderWidth: 0.6,
  });
  page.drawRectangle({
    x: opts.x + colWidth - 0.3,
    y,
    width: 0.6,
    height: opts.y - y,
    color: opts.rule,
  });
  return y;
}

function wrapCell(
  text: string,
  font: PdfFont,
  size: number,
  maxWidth: number
): string[] {
  const safe = text.replace(/\s+/g, ' ').trim() || '—';
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return [safe];
  const words = safe.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
      while (font.widthOfTextAtSize(current, size) > maxWidth && current.length > 4) {
        let cut = current.length - 1;
        while (
          cut > 4 &&
          font.widthOfTextAtSize(`${current.slice(0, cut)}…`, size) > maxWidth
        ) {
          cut -= 1;
        }
        lines.push(`${current.slice(0, cut)}…`);
        current = current.slice(cut);
      }
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [safe];
}

function summarizeItems(items: QuoteItem[]): {
  lines: number;
  qty: number;
  totalPkr: number;
} {
  return items.reduce(
    (sum, item) => ({
      lines: sum.lines + 1,
      qty: sum.qty + toNumber(item.qty),
      totalPkr: sum.totalPkr + toNumber(item.price_snapshot) * toNumber(item.qty),
    }),
    { lines: 0, qty: 0, totalPkr: 0 }
  );
}

function formatPkrDisplay(amount: number): string {
  return `Rs ${new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function dash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : '—';
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPktParts(iso: string | null): { date: string; time: string } {
  const date = iso ? new Date(iso) : new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = value('hour').padStart(2, '0');
  const minute = value('minute').padStart(2, '0');
  return {
    date: `${value('day')} ${value('month')} ${value('year')}`,
    time: `${hour}:${minute}`,
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

  const headerRange = `${quoteSheetRange(ORDERS_TAB)}!A1:O1`;
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
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      `${quoteSheetRange(ORDERS_TAB)}!P:Z`
    )}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
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
