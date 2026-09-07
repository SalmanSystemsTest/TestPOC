import { supabase } from '../supabase';

/**
 * Asks the notify-quote function to append the request to the SSG sheet.
 * Must never throw back to the submit path — the row is already committed.
 */
export async function dispatchQuoteNotification(
  quoteRequestId: string
): Promise<void> {
  try {
    await supabase.functions.invoke('notify-quote', {
      body: { quote_request_id: quoteRequestId },
    });
  } catch {
    // Sheets / function failures stay in notification_log, not the buyer UI.
  }
}
