const LTR = '\u202A';
const PDF = '\u202C';

function wrapLtr(value: string): string {
  return `${LTR}${value}${PDF}`;
}

export function formatPkrAmount(amount: number): string {
  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Rs ${formatted}`;
}

export function formatPkr(amount: number): string {
  return wrapLtr(formatPkrAmount(amount));
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
