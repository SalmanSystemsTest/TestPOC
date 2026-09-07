import { Linking } from 'react-native';
import { config, hasWhatsapp } from './config';
import { formatPkrAmount, localisedName } from './format';
import type { CartLine, SubmittedQuote } from './queries/cart';
import type { Profile } from './queries/profile';

export type OrderWhatsappLabels = {
  heading: string;
  itemsLabel: string;
  totalLabel: string;
  noteLabel: string;
};

export function buildOrderWhatsappMessage(params: {
  request: SubmittedQuote;
  lines: CartLine[];
  note: string;
  profile: Profile | null;
  language: string;
  labels: OrderWhatsappLabels;
}): string {
  const lineText = params.lines.map((line, index) => {
    const name = localisedName(line.part, params.language);
    const brand = line.part.brand ? ` (${line.part.brand})` : '';
    const total = formatPkrAmount(line.part.price_pkr * line.qty);
    return `${index + 1}. ${line.part.sku} — ${name}${brand} × ${line.qty} = ${total}`;
  });

  const header: string[] = [params.labels.heading];
  if (params.profile?.business_name) header.push(params.profile.business_name);
  if (params.profile?.contact_name) header.push(params.profile.contact_name);
  const identifier = params.profile?.phone ?? params.profile?.email;
  if (identifier) header.push(identifier);
  if (params.profile?.city) header.push(params.profile.city);

  const footer = [
    `${params.labels.itemsLabel}: ${params.request.item_count}`,
    `${params.labels.totalLabel}: ${formatPkrAmount(params.request.total_pkr)}`,
  ];
  const note = params.note.trim();
  if (note) footer.push(`${params.labels.noteLabel}: ${note}`);

  return [...header, '', ...lineText, '', ...footer].join('\n');
}

export function openSsgWhatsapp(text: string): void {
  if (!hasWhatsapp || !config.ssgWhatsapp) return;
  void Linking.openURL(
    `https://wa.me/${config.ssgWhatsapp}?text=${encodeURIComponent(text)}`
  );
}
