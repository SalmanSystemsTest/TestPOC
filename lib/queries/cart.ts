// Request-basket reads and writes. The basket ends in a quote request,
// never a checkout.
//
// Quantity editing, removal, and submit_quote_request land with the cart
// screen; what is here is what the part-detail screen needs.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toPkrNumber } from '../format';
import { supabase } from '../supabase';
import type { Part } from './parts';

type CartPartEmbed = Part & {
  categories?: { icon?: string | null; slug?: string | null } | null;
};

function unwrapCartPart(
  value: CartPartEmbed | CartPartEmbed[] | null | undefined
): { part: Part; categoryIcon: string | null } | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') return null;
  const { categories, ...part } = row;
  return {
    part: { ...part, price_pkr: toPkrNumber(part.price_pkr) },
    categoryIcon: categories?.icon ?? categories?.slug ?? null,
  };
}

export type CartLine = {
  part: Part;
  qty: number;
  categoryIcon: string | null;
};

export type SubmittedQuote = {
  id: string;
  reference: string;
  item_count: number;
  total_pkr: number;
};

export function useCart(userId: string | undefined) {
  return useQuery({
    queryKey: ['cart', 'lines', userId],
    enabled: typeof userId === 'string',
    queryFn: async (): Promise<CartLine[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('cart_items')
        .select('qty, parts(*, categories(icon, slug))')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data.flatMap((row) => {
        const embedded = unwrapCartPart(row.parts);
        if (!embedded) return [];
        return [
          {
            part: embedded.part,
            qty: toPkrNumber(row.qty) || 1,
            categoryIcon: embedded.categoryIcon,
          },
        ];
      });
    },
  });
}

export function useCartItemCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['cart', 'count', userId],
    enabled: typeof userId === 'string',
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const { data, error } = await supabase
        .from('cart_items')
        .select('qty')
        .eq('user_id', userId);
      if (error) throw error;
      return data.reduce((sum, row) => sum + row.qty, 0);
    },
  });
}

/**
 * Adding a part already in the basket bumps its quantity rather than
 * failing on the composite primary key.
 */
export function useAddToCart(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { partId: string; qty?: number }) => {
      if (!userId) throw new Error('Not signed in');
      const addQty = params.qty ?? 1;

      const { data: existing, error: readError } = await supabase
        .from('cart_items')
        .select('qty')
        .eq('user_id', userId)
        .eq('part_id', params.partId)
        .maybeSingle();
      if (readError) throw readError;

      const nextQty = Math.min((existing?.qty ?? 0) + addQty, 9999);

      const { error } = await supabase
        .from('cart_items')
        .upsert(
          { user_id: userId, part_id: params.partId, qty: nextQty },
          { onConflict: 'user_id,part_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useSetCartQuantity(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ partId, qty }: { partId: string; qty: number }) => {
      if (!userId) throw new Error('Not signed in');
      const bounded = Math.max(1, Math.min(qty, 9999));
      const { error } = await supabase
        .from('cart_items')
        .update({ qty: bounded, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('part_id', partId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useRemoveCartItem(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (partId: string) => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .eq('part_id', partId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}

export function useSubmitQuote(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (note: string): Promise<SubmittedQuote> => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase.rpc('submit_quote_request', {
        p_note: note.trim() || undefined,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) throw new Error('CART_EMPTY');
      let reference = row.reference?.trim() ?? '';
      if (!reference && row.id) {
        const fetched = await supabase
          .from('quote_requests')
          .select('reference')
          .eq('id', row.id)
          .maybeSingle();
        reference = fetched.data?.reference?.trim() ?? '';
      }
      return {
        id: row.id,
        reference,
        item_count: toPkrNumber(row.item_count),
        total_pkr: toPkrNumber(row.total_pkr),
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });
}
