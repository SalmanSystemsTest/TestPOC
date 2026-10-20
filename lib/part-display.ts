import type { Part } from './queries/parts';

/** Buyer-facing subtitle — no internal item id / sku. */
export function partCardSubtitle(part: Part): string {
  const bits = [part.make_name, part.sub_group_name, part.brand].filter(
    (value): value is string => Boolean(value?.trim())
  );
  return bits.join(' · ');
}

export type PartDetailRow = { labelKey: string; value: string };

/** Rows for part detail — catalogue fields only, no sku. */
export function partDetailRows(part: Part): PartDetailRow[] {
  const rows: PartDetailRow[] = [];
  const push = (labelKey: string, value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) rows.push({ labelKey, value: trimmed });
  };
  push('part.fieldOem', part.oem_number);
  push('part.fieldMake', part.make_name);
  push('part.fieldCatModel', part.cat_model);
  push('part.fieldItemModel', part.item_model);
  push('part.fieldGroup', part.group_name);
  push('part.fieldSubGroup', part.sub_group_name);
  push('part.fieldBrand', part.brand);
  push('part.fieldOrigin', part.origin);
  push('part.fieldUom', part.default_uom);
  return rows;
}
