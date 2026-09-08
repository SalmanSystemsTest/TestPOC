import type { Profile } from './profile';
import { supabase } from '../supabase';
import type { CartLine, SubmittedQuote } from './cart';

export type QuoteNotifyPayload = {
  request: SubmittedQuote;
  lines: CartLine[];
  note: string;
  profile: Profile | null;
  message: string;
};

/**
 * Asks the notify-quote function to append the request to the SSG sheet.
 * Must never throw back to the submit path — the row is already committed.
 */
export async function dispatchQuoteNotification(
  payload: QuoteNotifyPayload
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('notify-quote', {
      body: {
        quote_request_id: payload.request.id,
        reference: payload.request.reference,
        note: payload.note,
        item_count: payload.request.item_count,
        total_pkr: payload.request.total_pkr,
        message: payload.message,
        profile: payload.profile
          ? {
              business_name: payload.profile.business_name,
              contact_name: payload.profile.contact_name,
              phone: payload.profile.phone,
              email: payload.profile.email,
              city: payload.profile.city,
              address: payload.profile.address,
            }
          : null,
        items: payload.lines.map((line) => ({
          sku_snapshot: line.part.sku,
          name_snapshot: line.part.name,
          brand_snapshot: line.part.brand,
          oem_snapshot: line.part.oem_number,
          price_snapshot: line.part.price_pkr,
          qty: line.qty,
        })),
      },
    });
    if (error) {
      console.warn('notify-quote failed', error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'notify-quote failed';
    console.warn(message);
  }
}
