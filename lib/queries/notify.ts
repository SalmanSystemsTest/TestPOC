import { config } from '../config';
import { toPkrNumber } from '../format';
import { supabase } from '../supabase';
import type { CartLine, SubmittedQuote } from './cart';
import type { Profile } from './profile';

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
  const body = {
    quote_request_id: payload.request.id,
    reference: payload.request.reference,
    note: payload.note,
    item_count: toPkrNumber(payload.request.item_count),
    total_pkr: toPkrNumber(payload.request.total_pkr),
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
      price_snapshot: toPkrNumber(line.part.price_pkr),
      qty: toPkrNumber(line.qty) || 1,
    })),
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: config.supabaseKey,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(
        `${config.supabaseUrl.replace(/\/$/, '')}/functions/v1/notify-quote`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }
      );
      const data = (await response.json().catch(() => null)) as {
        accepted?: boolean;
        sheets?: boolean;
        error?: string;
      } | null;
      if (!response.ok) {
        lastError = data?.error ?? `notify-quote ${response.status}`;
      } else if (data?.accepted || data?.sheets || !data) {
        return;
      } else {
        lastError = data.error ?? 'sheets_failed';
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'notify-quote failed';
    }
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  if (lastError) {
    console.warn('notify-quote failed', lastError);
  }
}
