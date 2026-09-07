// Vehicle taxonomy and category lookups for the catalogue filters.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type Make = Tables<'makes'>;
export type Model = Tables<'models'>;
export type Variant = Tables<'variants'>;
export type Category = Tables<'categories'>;

/** Taxonomy changes only when SSG re-imports, so it is worth caching hard. */
const TAXONOMY_STALE_MS = 5 * 60 * 1000;

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    staleTime: TAXONOMY_STALE_MS,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useMakes() {
  return useQuery({
    queryKey: ['makes'],
    staleTime: TAXONOMY_STALE_MS,
    queryFn: async (): Promise<Make[]> => {
      const { data, error } = await supabase
        .from('makes')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useModels(makeId: number | null) {
  return useQuery({
    queryKey: ['models', makeId],
    enabled: makeId !== null,
    staleTime: TAXONOMY_STALE_MS,
    queryFn: async (): Promise<Model[]> => {
      if (makeId === null) return [];
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('make_id', makeId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useVariants(modelId: number | null) {
  return useQuery({
    queryKey: ['variants', modelId],
    enabled: modelId !== null,
    staleTime: TAXONOMY_STALE_MS,
    queryFn: async (): Promise<Variant[]> => {
      if (modelId === null) return [];
      const { data, error } = await supabase
        .from('variants')
        .select('*')
        .eq('model_id', modelId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}
