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
  skipped: number;
  errors: string[];
};

type PartRow = {
  sheetRow: number;
  sku: string;
  name: string;
  nameUr: string | null;
  brand: string | null;
  oemNumber: string | null;
  categorySlug: string;
  pricePkr: number;
  description: string | null;
  descriptionUr: string | null;
  imageUrl: string | null;
  isActive: boolean;
};

type FitmentRow = {
  sheetRow: number;
  sku: string;
  make: string;
  model: string | null;
  variant: string | null;
};

type Category = { id: number; slug: string };

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
    const partsSheet = findSheet(workbook, 'parts');
    const fitmentSheet = findSheet(workbook, 'fitment');
    if (!partsSheet) {
      return json(emptySummary(['Missing sheet: Parts']), 200);
    }
    if (!fitmentSheet) {
      return json(emptySummary(['Missing sheet: Fitment']), 200);
    }

    const { data: categories, error: categoryError } = await service
      .from('categories')
      .select('id, slug');
    if (categoryError) throw categoryError;

    const categoryBySlug = new Map(
      (categories as Category[]).map((row) => [row.slug.toLowerCase(), row])
    );

    const parsedParts = parseParts(workbook.Sheets[partsSheet], categoryBySlug);
    const parsedFitment = parseFitment(workbook.Sheets[fitmentSheet]);
    const errors = [...parsedParts.errors, ...parsedFitment.errors];
    if (parsedParts.rows.length === 0 && parsedParts.errors.length === 0) {
      errors.push('Parts sheet has no data rows');
    }

    const partSkus = new Set(parsedParts.rows.map((row) => row.sku));
    for (const row of parsedFitment.rows) {
      if (!partSkus.has(row.sku)) {
        errors.push(`Fitment row ${row.sheetRow}: SKU ${row.sku} is not in the Parts sheet`);
      }
    }

    const summary: ImportSummary = {
      rowsRead: parsedParts.rowsRead,
      created: 0,
      updated: 0,
      skipped: parsedParts.skipped,
      errors,
    };

    if (errors.length > 0) {
      return json(summary);
    }

    const applied = await applyImport(service, parsedParts.rows, parsedFitment.rows);
    return json({ ...summary, ...applied });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'import-parts failed';
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

function parseParts(
  sheet: XLSX.WorkSheet,
  categoryBySlug: Map<string, Category>
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
    const sku = text(mapped.sku);
    const name = text(mapped.name);
    const categorySlug = text(mapped.category).toLowerCase();
    const hasAny = Object.values(mapped).some((value) => text(value).length > 0);

    if (!sku && !hasAny) {
      skipped += 1;
      return;
    }
    if (!sku) {
      errors.push(`Parts row ${sheetRow}: SKU is required`);
      return;
    }
    if (seen.has(sku)) {
      errors.push(`Parts row ${sheetRow}: duplicate SKU ${sku}`);
      return;
    }
    seen.add(sku);

    if (!name) errors.push(`Parts row ${sheetRow}: Name is required`);
    if (!categorySlug) {
      errors.push(`Parts row ${sheetRow}: Category is required`);
    } else if (!categoryBySlug.has(categorySlug)) {
      errors.push(
        `Parts row ${sheetRow}: unknown category "${categorySlug}". Use an existing slug.`
      );
    }

    const price = parsePrice(mapped.price_pkr);
    if (price.error) errors.push(`Parts row ${sheetRow}: ${price.error}`);

    const active = parseActive(mapped.active);
    if (active.error) errors.push(`Parts row ${sheetRow}: ${active.error}`);

    rows.push({
      sheetRow,
      sku,
      name,
      nameUr: nullable(mapped.name_ur),
      brand: nullable(mapped.brand),
      oemNumber: nullable(mapped.oem_number ?? mapped.oem),
      categorySlug,
      pricePkr: price.value,
      description: nullable(mapped.description),
      descriptionUr: nullable(mapped.description_ur),
      imageUrl: nullable(mapped.image_filename ?? mapped.image_url),
      isActive: active.value,
    });
  });

  return { rows, rowsRead: rows.length, skipped, errors };
}

function parseFitment(
  sheet: XLSX.WorkSheet
): { rows: FitmentRow[]; errors: string[] } {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: true,
  });
  const rows: FitmentRow[] = [];
  const errors: string[] = [];

  raw.forEach((record, index) => {
    const sheetRow = index + 2;
    const mapped = mapRecord(record);
    const sku = text(mapped.sku);
    const make = text(mapped.make);
    const model = nullable(mapped.model);
    const variant = nullable(mapped.variant);
    if (!sku && !make && !model && !variant) return;

    if (!sku) errors.push(`Fitment row ${sheetRow}: SKU is required`);
    if (!make) errors.push(`Fitment row ${sheetRow}: Make is required`);
    if (variant && !model) {
      errors.push(`Fitment row ${sheetRow}: Variant needs a Model`);
    }
    if (make && !slugify(make)) {
      errors.push(`Fitment row ${sheetRow}: Make "${make}" cannot be slugified`);
    }
    if (model && !slugify(model)) {
      errors.push(`Fitment row ${sheetRow}: Model "${model}" cannot be slugified`);
    }
    if (variant && !slugify(variant)) {
      errors.push(`Fitment row ${sheetRow}: Variant "${variant}" cannot be slugified`);
    }

    rows.push({ sheetRow, sku, make, model, variant });
  });

  return { rows, errors };
}

async function applyImport(
  service: SupabaseClient,
  parts: PartRow[],
  fitments: FitmentRow[]
): Promise<{ created: number; updated: number }> {
  const { data: existing, error: existingError } = await service
    .from('parts')
    .select('id, sku')
    .in(
      'sku',
      parts.map((row) => row.sku)
    );
  if (existingError) throw existingError;

  const existingBySku = new Map(
    (existing ?? []).map((row) => [row.sku as string, row.id as string])
  );
  const { data: categories, error: categoryError } = await service
    .from('categories')
    .select('id, slug');
  if (categoryError) throw categoryError;
  const categoryId = new Map(
    (categories as Category[]).map((row) => [row.slug.toLowerCase(), row.id])
  );

  let created = 0;
  let updated = 0;
  const partIdBySku = new Map<string, string>();

  for (const row of parts) {
    const payload = {
      sku: row.sku,
      name: row.name,
      name_ur: row.nameUr,
      brand: row.brand,
      oem_number: row.oemNumber,
      category_id: categoryId.get(row.categorySlug) ?? null,
      price_pkr: row.pricePkr,
      description: row.description,
      description_ur: row.descriptionUr,
      image_url: row.imageUrl,
      is_active: row.isActive,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await service
      .from('parts')
      .upsert(payload, { onConflict: 'sku' })
      .select('id, sku')
      .single();
    if (error || !data) throw error ?? new Error(`Could not upsert ${row.sku}`);
    partIdBySku.set(data.sku as string, data.id as string);
    if (existingBySku.has(row.sku)) updated += 1;
    else created += 1;
  }

  const skusWithFitment = [...new Set(fitments.map((row) => row.sku))];
  const partIds = skusWithFitment
    .map((sku) => partIdBySku.get(sku))
    .filter((id): id is string => Boolean(id));

  if (partIds.length > 0) {
    const { error: deleteError } = await service
      .from('part_fitments')
      .delete()
      .in('part_id', partIds);
    if (deleteError) throw deleteError;
  }

  const makeCache = new Map<string, number>();
  const modelCache = new Map<string, number>();
  const variantCache = new Map<string, number>();
  const inserts: {
    part_id: string;
    make_id: number;
    model_id: number | null;
    variant_id: number | null;
  }[] = [];

  for (const row of fitments) {
    const partId = partIdBySku.get(row.sku);
    if (!partId) continue;
    const makeId = await upsertMake(service, makeCache, row.make);
    const modelId = row.model
      ? await upsertModel(service, modelCache, makeId, row.model)
      : null;
    const variantId =
      row.variant && modelId
        ? await upsertVariant(service, variantCache, modelId, row.variant)
        : null;
    inserts.push({
      part_id: partId,
      make_id: makeId,
      model_id: modelId,
      variant_id: variantId,
    });
  }

  if (inserts.length > 0) {
    const { error } = await service.from('part_fitments').insert(inserts);
    if (error) throw error;
  }

  return { created, updated };
}

async function upsertMake(
  service: SupabaseClient,
  cache: Map<string, number>,
  name: string
): Promise<number> {
  const slug = slugify(name);
  const cached = cache.get(slug);
  if (cached) return cached;

  const { data: existing } = await service
    .from('makes')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (existing) {
    cache.set(slug, existing.id as number);
    return existing.id as number;
  }

  const { data, error } = await service
    .from('makes')
    .insert({ slug, name, sort_order: 0 })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error(`Could not create make ${name}`);
  cache.set(slug, data.id as number);
  return data.id as number;
}

async function upsertModel(
  service: SupabaseClient,
  cache: Map<string, number>,
  makeId: number,
  name: string
): Promise<number> {
  const slug = slugify(name);
  const key = `${makeId}:${slug}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const { data: existing } = await service
    .from('models')
    .select('id')
    .eq('make_id', makeId)
    .eq('slug', slug)
    .maybeSingle();
  if (existing) {
    cache.set(key, existing.id as number);
    return existing.id as number;
  }

  const { data, error } = await service
    .from('models')
    .insert({ make_id: makeId, slug, name, sort_order: 0 })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error(`Could not create model ${name}`);
  cache.set(key, data.id as number);
  return data.id as number;
}

async function upsertVariant(
  service: SupabaseClient,
  cache: Map<string, number>,
  modelId: number,
  name: string
): Promise<number> {
  const slug = slugify(name);
  const key = `${modelId}:${slug}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const { data: existing } = await service
    .from('variants')
    .select('id')
    .eq('model_id', modelId)
    .eq('slug', slug)
    .maybeSingle();
  if (existing) {
    cache.set(key, existing.id as number);
    return existing.id as number;
  }

  const { data, error } = await service
    .from('variants')
    .insert({ model_id: modelId, slug, name, sort_order: 0 })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error(`Could not create variant ${name}`);
  cache.set(key, data.id as number);
  return data.id as number;
}

function findSheet(workbook: XLSX.WorkBook, wanted: string): string | null {
  return (
    workbook.SheetNames.find((name) => name.trim().toLowerCase() === wanted) ??
    null
  );
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
  return { rowsRead: 0, created: 0, updated: 0, skipped: 0, errors };
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
