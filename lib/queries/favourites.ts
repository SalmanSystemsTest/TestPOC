// Favourite part ids and the favourites grid, scoped to the current user.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Part } from './parts';

/**
 * Ids only, so a heart icon anywhere in the app can resolve its own state
 * without each card issuing a query.
 */
export function useFavouriteIds(userId: string | undefined) {
  return useQuery({
    queryKey: ['favourites', 'ids', userId],
    enabled: typeof userId === 'string',
    queryFn: async (): Promise<string[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('favourites')
        .select('part_id')
        .eq('user_id', userId);
      if (error) throw error;
      return data.map((row) => row.part_id);
    },
  });
}

export function useFavouriteParts(userId: string | undefined) {
  return useQuery({
    queryKey: ['favourites', 'parts', userId],
    enabled: typeof userId === 'string',
    queryFn: async (): Promise<Part[]> => {
      if (!userId) return [];

      const { data: rows, error } = await supabase
        .from('favourites')
        .select('part_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (rows.length === 0) return [];

      const ids = rows.map((row) => row.part_id);
      const { data: parts, error: partsError } = await supabase
        .from('parts')
        .select('*')
        .in('id', ids)
        .eq('is_active', true);
      if (partsError) throw partsError;

      // Preserve the most-recently-favourited-first order from the join table.
      const order = new Map(ids.map((id, index) => [id, index]));
      return [...parts].sort(
        (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
      );
    },
  });
}

export function useToggleFavourite(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { partId: string; isFavourite: boolean }) => {
      if (!userId) throw new Error('Not signed in');

      if (params.isFavourite) {
        const { error } = await supabase
          .from('favourites')
          .delete()
          .eq('user_id', userId)
          .eq('part_id', params.partId);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('favourites')
        .insert({ user_id: userId, part_id: params.partId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favourites'] });
    },
  });
}
