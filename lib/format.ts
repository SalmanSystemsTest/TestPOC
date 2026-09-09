const LTR = '\u202A';
const PDF = '\u202C';

function wrapLtr(value: string): string {
  return `${LTR}${value}${PDF}`;
}

export function toPkrNumber(amount: number | string | null | undefined): number {
  if (typeof amount === 'number') {
    return Number.isFinite(amount) ? amount : 0;
  }
  if (typeof amount !== 'string') return 0;
  const parsed = Number(amount.replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function lineTotalPkr(
  unit: number | string | null | undefined,
  qty: number | string | null | undefined
): number {
  return toPkrNumber(unit) * toPkrNumber(qty);
}

export function sumLineTotalsPkr(
  lines: readonly {
    price: number | string | null | undefined;
    qty: number | string | null | undefined;
  }[]
): number {
  return lines.reduce((sum, line) => sum + lineTotalPkr(line.price, line.qty), 0);
}

export function sumItemQty(
  lines: readonly { qty: number | string | null | undefined }[]
): number {
  return lines.reduce((sum, line) => sum + toPkrNumber(line.qty), 0);
}

export function formatPkrAmount(
  amount: number | string | null | undefined
): string {
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(toPkrNumber(amount));
  return `Rs ${formatted}`;
}

export function formatPkr(amount: number | string | null | undefined): string {
  return formatPkrAmount(amount);
}

/**
 * Taxonomy and catalogue rows carry their own Urdu column rather than a
 * translation key, because the values are data entered by SSG.
 */
export function localisedName(
  row: { name: string; name_ur: string | null },
  language: string
): string {
  return language === 'ur' && row.name_ur ? row.name_ur : row.name;
}

export function formatDate(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  return wrapLtr(formatted);
}
