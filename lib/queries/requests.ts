// Server-side queries for quote request list and read-only detail.

import { useQuery } from '@tanstack/react-query';
import { sumLineTotalsPkr, toPkrNumber } from '../format';
import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type QuoteRequest = Tables<'quote_requests'>;
export type QuoteRequestItem = Tables<'quote_request_items'>;

export function useRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ['requests', userId],
    enabled: typeof userId === 'string',
    queryFn: async (): Promise<QuoteRequest[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('quote_requests')
        .select('*, quote_request_items(price_snapshot, qty)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((row) => {
        const { quote_request_items: items, ...request } = row;
        const fromLines = sumLineTotalsPkr(
          (items ?? []).map((item) => ({
            price: item.price_snapshot,
            qty: item.qty,
          }))
        );
        return {
          ...request,
          total_pkr: fromLines > 0 ? fromLines : toPkrNumber(request.total_pkr),
          item_count: toPkrNumber(request.item_count),
        };
      });
    },
  });
}

export function useRequest(
  userId: string | undefined,
  requestId: string | undefined
) {
  return useQuery({
    queryKey: ['request', requestId, userId],
    enabled: Boolean(userId && requestId),
    queryFn: async (): Promise<{
      request: QuoteRequest;
      items: QuoteRequestItem[];
    } | null> => {
      if (!userId || !requestId) return null;
      const [requestResult, itemsResult] = await Promise.all([
        supabase
          .from('quote_requests')
          .select('*')
          .eq('id', requestId)
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('quote_request_items')
          .select('*')
          .eq('quote_request_id', requestId)
          .order('name_snapshot', { ascending: true }),
      ]);
      if (requestResult.error) throw requestResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (!requestResult.data) return null;
      const items = itemsResult.data ?? [];
      const fromLines = sumLineTotalsPkr(
        items.map((item) => ({
          price: item.price_snapshot,
          qty: item.qty,
        }))
      );
      return {
        request: {
          ...requestResult.data,
          total_pkr:
            fromLines > 0
              ? fromLines
              : toPkrNumber(requestResult.data.total_pkr),
          item_count: toPkrNumber(requestResult.data.item_count),
        },
        items: items.map((item) => ({
          ...item,
          price_snapshot: toPkrNumber(item.price_snapshot),
          qty: toPkrNumber(item.qty) || 1,
        })),
      };
    },
  });
}
