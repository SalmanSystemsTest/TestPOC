// Appends a submitted quote request to the SSG Orders sheet. The buyer
// submit path is already committed before this runs.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';
import { SSG_LOGO_PNG_BASE64 } from './ssg-logo.ts';

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

    const sheetsResult = await appendOrderRows(quote);
    const emailResult = await sendOrderEmail(quote);
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
    await new Promise((resolve) => setTimeout(resolve, 800));
    const retry = await service
      .from('quote_request_items')
      .select(
        'sku_snapshot, name_snapshot, brand_snapshot, oem_snapshot, price_snapshot, qty'
      )
      .eq('quote_request_id', quoteRequestId);
    if (retry.error) throw retry.error;
    items = retry.data;
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
    let pdf: string | null = null;
    try {
      pdf = await buildOrderPdf(loaded);
    } catch {
      pdf = null;
    }
    const attachments: Record<string, unknown>[] = [
      {
        filename: 'ssg-logo.png',
        content: SSG_LOGO_PNG_BASE64,
        content_id: 'ssg-logo',
        contentId: 'ssg-logo',
        content_type: 'image/png',
      },
    ];
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
              <img src="cid:ssg-logo" alt="SSG Auto Parts" height="40" style="display:block;border:0;" />
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

  const drawHeader = () => {
    page.drawRectangle({
      x: 0,
      y: pageHeight - 78,
      width: pageWidth,
      height: 78,
      color: navy,
    });
    page.drawRectangle({
      x: 0,
      y: pageHeight - 82,
      width: pageWidth,
      height: 4,
      color: red,
    });
    if (logo && typeof logo === 'object' && 'width' in logo && 'height' in logo) {
      const image = logo as { width: number; height: number };
      const height = 36;
      const width = (image.width / image.height) * height;
      page.drawImage(logo, {
        x: margin,
        y: pageHeight - 58,
        width,
        height,
      });
    } else {
      page.drawText('SSG Auto Parts', {
        x: margin,
        y: pageHeight - 48,
        size: 18,
        font: bold,
        color: white,
      });
    }
    page.drawText('Trusted since 1971', {
      x: pageWidth - margin - 108,
      y: pageHeight - 48,
      size: 10,
      font,
      color: rgb(0.76, 0.8, 0.89),
    });
    y = pageHeight - 104;
  };

  drawHeader();

  page.drawText('Quote sheet', {
    x: margin,
    y,
    size: 16,
    font: bold,
    color: navy,
  });
  const refText = loaded.request.reference;
  page.drawText(refText, {
    x: pageWidth - margin - bold.widthOfTextAtSize(refText, 12),
    y,
    size: 12,
    font: bold,
    color: red,
  });
  y -= 18;
  page.drawText('Indicative prices. SSG will confirm the final order by phone.', {
    x: margin,
    y,
    size: 9,
    font,
    color: muted,
  });
  y -= 22;

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
    ensure,
  });
  y -= 18;

  page.drawText('Order details', {
    x: margin,
    y,
    size: 13,
    font: bold,
    color: navy,
  });
  y -= 16;

  const columns: PdfColumn[] = [
    { key: '#', width: 22, align: 'right' },
    { key: 'SKU', width: 68, align: 'left' },
    { key: 'Part name', width: 128, align: 'left' },
    { key: 'Brand', width: 68, align: 'left' },
    { key: 'OEM', width: 68, align: 'left' },
    { key: 'Qty', width: 32, align: 'right' },
    { key: 'Unit PKR', width: 68, align: 'right' },
    { key: 'Line PKR', width: 69, align: 'right' },
  ];

  const drawItemsHeader = () => {
    ensure(22);
    drawRowBackground(page, margin, y - 4, tableWidth, 18, headerFill);
    let x = margin;
    for (const column of columns) {
      const label = column.key;
      const textX =
        column.align === 'right'
          ? x + column.width - 4 - font.widthOfTextAtSize(label, 8)
          : x + 4;
      page.drawText(label, {
        x: textX,
        y,
        size: 8,
        font: bold,
        color: white,
      });
      x += column.width;
    }
    y -= 18;
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
      wrapCell(values[colIndex] ?? '', font, 8, column.width - 8)
    );
    const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
    const rowHeight = lineCount * 11 + 8;
    if (y - rowHeight < 48) {
      newPage();
      drawItemsHeader();
    }
    if (index % 2 === 0) {
      drawRowBackground(page, margin, y - rowHeight + 10, tableWidth, rowHeight, zebra);
    }
    let x = margin;
    columns.forEach((column, colIndex) => {
      wrapped[colIndex].forEach((line, lineIndex) => {
        const textX =
          column.align === 'right'
            ? x + column.width - 4 - font.widthOfTextAtSize(line, 8)
            : x + 4;
        page.drawText(line, {
          x: textX,
          y: y - lineIndex * 11,
          size: 8,
          font,
          color: ink,
        });
      });
      x += column.width;
    });
    y -= rowHeight;
  });

  y -= 8;
  ensure(70);
  const summary = [
    ['Line items', String(totals.lines)],
    ['Total quantity', String(totals.qty)],
    ['Indicative total', formatPkrDisplay(totals.totalPkr || toNumber(loaded.request.total_pkr))],
  ];
  const boxWidth = 220;
  const boxX = pageWidth - margin - boxWidth;
  const boxHeight = summary.length * 16 + 14;
  page.drawRectangle({
    x: boxX,
    y: y - boxHeight + 12,
    width: boxWidth,
    height: boxHeight,
    color: zebra,
    borderColor: rule,
    borderWidth: 0.6,
  });
  summary.forEach((row, index) => {
    const rowY = y - index * 16;
    page.drawText(row[0], {
      x: boxX + 10,
      y: rowY,
      size: 9,
      font,
      color: muted,
    });
    page.drawText(row[1], {
      x: boxX + boxWidth - 10 - bold.widthOfTextAtSize(row[1], 10),
      y: rowY,
      size: 10,
      font: bold,
      color: index === 2 ? red : navy,
    });
  });
  y -= boxHeight + 16;

  ensure(56);
  page.drawText('Buyer comments', {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: navy,
  });
  y -= 16;
  const commentLines = wrapCell(note, font, 9, tableWidth - 16);
  const commentHeight = commentLines.length * 12 + 14;
  ensure(commentHeight + 8);
  page.drawRectangle({
    x: margin,
    y: y - commentHeight + 12,
    width: tableWidth,
    height: commentHeight,
    color: rgb(1, 0.984, 0.96),
    borderColor: rule,
    borderWidth: 0.6,
  });
  commentLines.forEach((line, index) => {
    page.drawText(line, {
      x: margin + 8,
      y: y - index * 12,
      size: 9,
      font,
      color: ink,
    });
  });

  return doc.saveAsBase64();
}

type PdfColumn = {
  key: string;
  width: number;
  align: 'left' | 'right';
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
    ensure: (needed: number) => void;
  }
): number {
  const colWidth = opts.width / 2;
  const labelWidth = 64;
  let y = opts.y;
  for (let index = 0; index < opts.rows.length; index += 2) {
    const left = opts.rows[index];
    const right = opts.rows[index + 1];
    const leftLines = wrapCell(left[1], opts.font, 9, colWidth - labelWidth - 12);
    const rightLines = right
      ? wrapCell(right[1], opts.font, 9, colWidth - labelWidth - 12)
      : [''];
    const height = Math.max(leftLines.length, rightLines.length) * 12 + 8;
    opts.ensure(height);
    if (index % 4 === 0) {
      drawRowBackground(page, opts.x, y - height + 10, opts.width, height, opts.zebra);
    }
    page.drawText(left[0], {
      x: opts.x + 6,
      y,
      size: 8,
      font: opts.bold,
      color: opts.muted,
    });
    leftLines.forEach((line, lineIndex) => {
      page.drawText(line, {
        x: opts.x + labelWidth,
        y: y - lineIndex * 12,
        size: 9,
        font: opts.font,
        color: opts.ink,
      });
    });
    if (right) {
      page.drawText(right[0], {
        x: opts.x + colWidth + 6,
        y,
        size: 8,
        font: opts.bold,
        color: opts.muted,
      });
      rightLines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: opts.x + colWidth + labelWidth,
          y: y - lineIndex * 12,
          size: 9,
          font: opts.font,
          color: opts.ink,
        });
      });
    }
    y -= height;
  }
  page.drawRectangle({
    x: opts.x,
    y: y + 6,
    width: opts.width,
    height: opts.y - y,
    borderColor: opts.rule,
    borderWidth: 0.6,
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
