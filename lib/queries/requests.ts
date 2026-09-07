// Server-side queries for quote request list and read-only detail.

import { useQuery } from '@tanstack/react-query';
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
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
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
      return { request: requestResult.data, items: itemsResult.data };
    },
  });
}
