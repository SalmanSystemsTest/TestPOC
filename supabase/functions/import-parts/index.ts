// Validates an uploaded Excel catalogue, then upserts parts and fitment.
// The whole file is checked before anything is written.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';
import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type ImportSummary = {
  rowsRead: number;
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  errors: string[];
};

type PartRow = {
  sheetRow: number;
  sku: string;
  name: string;
  masterPn: string | null;
  childPn: string | null;
  oemNumber: string | null;
  defaultUom: string | null;
  itemModel: string | null;
  catModel: string | null;
  modelG: string | null;
  makeName: string | null;
  groupName: string | null;
  subGroupName: string | null;
  brand: string | null;
  origin: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { path?: string };
    const path = body.path?.trim() ?? '';
    if (!path || path.includes('..') || path.includes('/') || path.includes('\\')) {
      return json({ error: 'A valid uploaded file path is required' }, 400);
    }

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const secretKey = readSecretKey();
    if (!secretKey) return json({ error: 'Service key is not configured' }, 500);

    const service = createClient(supabaseUrl, secretKey);
    const allowed = await callerIsAdmin(req, service);
    if (!allowed) return json({ error: 'Unauthorized' }, 401);

    const downloaded = await service.storage.from('imports').download(path);
    if (downloaded.error || !downloaded.data) {
      return json(
        { error: downloaded.error?.message ?? 'Could not read the uploaded file' },
        400
      );
    }

    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    const workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
    const sheetName =
      workbook.SheetNames.find((name) =>
        name.toLowerCase().includes('main view')
      ) ?? workbook.SheetNames[0];
    if (!sheetName) {
      return json(emptySummary(['The workbook has no sheets']), 200);
    }

    const parsedParts = parseClientSheet(workbook.Sheets[sheetName]);
    const errors = [...parsedParts.errors];
    if (parsedParts.rows.length === 0 && parsedParts.errors.length === 0) {
      errors.push('The sheet has no data rows');
    }

    const summary: ImportSummary = {
      rowsRead: parsedParts.rowsRead,
      created: 0,
      updated: 0,
      removed: 0,
      skipped: parsedParts.skipped,
      errors,
    };

    if (errors.length > 0) {
      return json(summary);
    }

    const applied = await applyClientImport(service, parsedParts.rows);
    return json({ ...summary, ...applied });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'import-parts failed';
    return json({ error: message }, 500);
  }
});

async function callerIsAdmin(req: Request, service: SupabaseClient): Promise<boolean> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return false;

  const { data } = await service.auth.getUser(jwt);
  if (!data.user) return false;

  const { data: profile } = await service
    .from('profiles')
    .select('role, status')
    .eq('id', data.user.id)
    .maybeSingle();

  return profile?.role === 'admin' && profile.status === 'active';
}

function parseClientSheet(
  sheet: XLSX.WorkSheet
): { rows: PartRow[]; rowsRead: number; skipped: number; errors: string[] } {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });
  const rows: PartRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  raw.forEach((record, index) => {
    const sheetRow = index + 2;
    const mapped = mapRecord(record);
    const sku = text(mapped.item_id ?? mapped.sku);
    const name = text(mapped.item_descr ?? mapped.name);
    const hasAny = Object.values(mapped).some((value) => text(value).length > 0);

    if (!sku) {
      if (name) {
        errors.push(`Row ${sheetRow}: Item ID is required`);
        return;
      }
      skipped += 1;
      return;
    }
    if (!name) {
      errors.push(`Row ${sheetRow}: Item Descr is required`);
      return;
    }
    if (seen.has(sku)) {
      errors.push(`Row ${sheetRow}: duplicate Item ID ${sku}`);
      return;
    }
    seen.add(sku);

    rows.push({
      sheetRow,
      sku,
      name,
      masterPn: nullable(mapped['master_p/n'] ?? mapped.master_pn),
      childPn: nullable(mapped['child_p/n'] ?? mapped.child_pn),
      oemNumber: nullable(mapped.oem_no ?? mapped.oem_number),
      defaultUom: nullable(mapped.default_uom),
      itemModel: nullable(mapped.item_model),
      catModel: nullable(mapped.cat_model),
      modelG: nullable(mapped.model_g),
      makeName: nullable(mapped.make),
      groupName: nullable(mapped.group_id ?? mapped.group),
      subGroupName: nullable(mapped.sub_group_id ?? mapped.sub_group),
      brand: nullable(mapped.brand),
      origin: nullable(mapped.origin),
    });
  });

  return { rows, rowsRead: rows.length, skipped, errors };
}

const UPSERT_BATCH = 100;

async function applyClientImport(
  service: SupabaseClient,
  parts: PartRow[]
): Promise<{ created: number; updated: number; removed: number }> {
  const importSkus = parts.map((row) => row.sku);
  const existingBySku = new Set<string>();
  for (let index = 0; index < importSkus.length; index += UPSERT_BATCH) {
    const slice = importSkus.slice(index, index + UPSERT_BATCH);
    const { data, error: existingError } = await service
      .from('parts')
      .select('sku')
      .in('sku', slice);
    if (existingError) throw existingError;
    for (const row of data ?? []) {
      existingBySku.add(row.sku as string);
    }
  }

  const { error: deactivateError } = await service
    .from('parts')
    .update({ is_active: false })
    .not('sku', 'is', null);
  if (deactivateError) throw deactivateError;

  // Client ItemList has no fitment sheet; drop legacy prototype links on each import.
  const { error: fitmentClearError } = await service
    .from('part_fitments')
    .delete()
    .not('part_id', 'is', null);
  if (fitmentClearError) throw fitmentClearError;

  let created = 0;
  let updated = 0;

  for (let index = 0; index < parts.length; index += UPSERT_BATCH) {
    const chunk = parts.slice(index, index + UPSERT_BATCH);
    const payloads = chunk.map((row) => ({
      sku: row.sku,
      name: row.name,
      master_pn: row.masterPn,
      child_pn: row.childPn,
      oem_number: row.oemNumber,
      default_uom: row.defaultUom,
      item_model: row.itemModel,
      cat_model: row.catModel,
      model_g: row.modelG,
      make_name: row.makeName,
      group_name: row.groupName,
      sub_group_name: row.subGroupName,
      brand: row.brand,
      origin: row.origin,
      price_pkr: null,
      category_id: null,
      is_active: true,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await service.from('parts').upsert(payloads, {
      onConflict: 'sku',
    });
    if (error) throw error;
    for (const row of chunk) {
      if (existingBySku.has(row.sku)) updated += 1;
      else created += 1;
    }
  }

  // Past quote lines may still reference old part rows; hide them from the catalogue
  // instead of hard-deleting (FK on quote_request_items.part_id).
  const { count: removedCount, error: removedError } = await service
    .from('parts')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', false);
  if (removedError) throw removedError;

  return { created, updated, removed: removedCount ?? 0 };
}

function mapRecord(record: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    mapped[normaliseHeader(key)] = value;
  }
  return mapped;
}

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function nullable(value: unknown): string | null {
  const next = text(value);
  return next.length > 0 ? next : null;
}

function parsePrice(value: unknown): { value: number; error: string | null } {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return { value, error: null };
  }
  const raw = text(value);
  if (!raw) return { value: 0, error: 'Price_PKR is required' };
  if (/rs|₨|,/i.test(raw)) {
    return { value: 0, error: 'Price_PKR must be a number with no Rs or commas' };
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: 0, error: 'Price_PKR must be a number' };
  }
  return { value: parsed, error: null };
}

function parseActive(value: unknown): { value: boolean; error: string | null } {
  if (value === '' || value === null || value === undefined) {
    return { value: true, error: null };
  }
  if (typeof value === 'boolean') return { value, error: null };
  if (typeof value === 'number') {
    if (value === 1) return { value: true, error: null };
    if (value === 0) return { value: false, error: null };
  }
  const raw = text(value).toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(raw)) return { value: true, error: null };
  if (['false', 'no', 'n', '0'].includes(raw)) return { value: false, error: null };
  return { value: true, error: 'Active must be TRUE or FALSE' };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function emptySummary(errors: string[]): ImportSummary {
  return { rowsRead: 0, created: 0, updated: 0, removed: 0, skipped: 0, errors };
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
