import { Linking } from 'react-native';
import { config, hasWhatsapp } from './config';
import { localisedName } from './format';
import type { CartLine, SubmittedQuote } from './queries/cart';
import type { Profile } from './queries/profile';

export type OrderWhatsappLabels = {
  title: string;
  reference: string;
  shop: string;
  contact: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  parts: string;
  oem: string;
  itemsLabel: string;
  totalLabel: string;
  quantity: string;
  noteLabel: string;
  followUp: string;
};

export function buildOrderWhatsappMessage(params: {
  request: SubmittedQuote;
  lines: CartLine[];
  note: string;
  profile: Profile | null;
  language: string;
  labels: OrderWhatsappLabels;
}): string {
  const { labels, profile } = params;
  const blocks: string[] = [
    `*${labels.title}*`,
    `${labels.reference}: ${params.request.reference}`,
  ];

  const shopLines: string[] = [];
  if (profile?.business_name) {
    shopLines.push(`${labels.shop}: ${profile.business_name}`);
  }
  if (profile?.contact_name) {
    shopLines.push(`${labels.contact}: ${profile.contact_name}`);
  }
  if (profile?.phone) shopLines.push(`${labels.phone}: ${profile.phone}`);
  if (profile?.email) shopLines.push(`${labels.email}: ${profile.email}`);
  if (profile?.address) shopLines.push(`${labels.address}: ${profile.address}`);
  if (profile?.city) shopLines.push(`${labels.city}: ${profile.city}`);
  if (shopLines.length) blocks.push('', ...shopLines);

  blocks.push('', `*${labels.parts}*`);
  params.lines.forEach((line, index) => {
    const name = localisedName(line.part, params.language);
    const meta = [
      line.part.master_pn ? `Master ${line.part.master_pn}` : null,
      line.part.child_pn ? `Child ${line.part.child_pn}` : null,
      line.part.brand,
      line.part.oem_number ? `${labels.oem} ${line.part.oem_number}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(' | ');

    blocks.push(
      `${index + 1}. ${name}`,
      ...(meta ? [`    ${meta}`] : []),
      `    ${labels.quantity ?? 'Qty'}: ${line.qty}`
    );
  });

  blocks.push('', `${labels.itemsLabel}: ${params.request.item_count}`);

  const note = params.note.trim();
  if (note) blocks.push('', `${labels.noteLabel}: ${note}`);
  blocks.push('', labels.followUp);

  return blocks.join('\n');
}

export function openSsgWhatsapp(text: string): void {
  if (!hasWhatsapp || !config.ssgWhatsapp) return;
  void Linking.openURL(
    `https://wa.me/${config.ssgWhatsapp}?text=${encodeURIComponent(text)}`
  );
}
