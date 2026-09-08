// Server-side queries for parts search and part detail.

import {
  useInfiniteQuery,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { toPkrNumber } from '../format';
import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type Part = Tables<'parts'>;

export const PAGE_SIZE = 20;

export type PartFilters = {
  query: string;
  makeId: number | null;
  modelId: number | null;
  variantId: number | null;
  categoryId: number | null;
};

export const emptyFilters: PartFilters = {
  query: '',
  makeId: null,
  modelId: null,
  variantId: null,
  categoryId: null,
};

export function hasVehicleFilter(filters: PartFilters): boolean {
  return filters.makeId !== null;
}

/**
 * All filtering and paging happens inside the search_parts RPC. Passing
 * undefined rather than null lets the function's own defaults apply, and
 * keeps the fitment-nullability logic in one place in SQL.
 */
async function fetchPartsPage(
  filters: PartFilters,
  offset: number
): Promise<Part[]> {
  const trimmed = filters.query.trim();
  const { data, error } = await supabase.rpc('search_parts', {
    p_query: trimmed.length > 0 ? trimmed : undefined,
    p_make: filters.makeId ?? undefined,
    p_model: filters.modelId ?? undefined,
    p_variant: filters.variantId ?? undefined,
    p_category: filters.categoryId ?? undefined,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []).map((part) => ({
    ...part,
    price_pkr: toPkrNumber(part.price_pkr),
  }));
}

export function prefetchCatalogue(queryClient: QueryClient): Promise<void> {
  return queryClient.prefetchInfiniteQuery({
    queryKey: ['parts', 'search', emptyFilters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPartsPage(emptyFilters, pageParam),
    staleTime: 2 * 60 * 1000,
  });
}

export function usePartsSearch(filters: PartFilters) {
  return useInfiniteQuery({
    queryKey: ['parts', 'search', filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPartsPage(filters, pageParam),
    getNextPageParam: (lastPage: Part[], allPages: Part[][]) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    staleTime: 2 * 60 * 1000,
  });
}

export function usePart(id: string | undefined) {
  return useQuery({
    queryKey: ['part', id],
    enabled: typeof id === 'string' && id.length > 0,
    queryFn: async (): Promise<Part | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * One fitment rule. A null model or variant means the rule covers
 * everything below it, which the detail screen renders as
 * "All Toyota models" rather than leaving a blank.
 */
export type FitmentRule = {
  id: number;
  makeName: string;
  makeNameUr: string | null;
  modelName: string | null;
  modelNameUr: string | null;
  variantName: string | null;
  variantNameUr: string | null;
};

export function usePartFitments(partId: string | undefined) {
  return useQuery({
    queryKey: ['part', partId, 'fitments'],
    enabled: typeof partId === 'string' && partId.length > 0,
    queryFn: async (): Promise<FitmentRule[]> => {
      if (!partId) return [];

      const { data: rows, error } = await supabase
        .from('part_fitments')
        .select('id, make_id, model_id, variant_id')
        .eq('part_id', partId);
      if (error) throw error;
      if (rows.length === 0) return [];

      const makeIds = [...new Set(rows.map((r) => r.make_id))];
      const modelIds = [
        ...new Set(rows.flatMap((r) => (r.model_id === null ? [] : [r.model_id]))),
      ];
      const variantIds = [
        ...new Set(
          rows.flatMap((r) => (r.variant_id === null ? [] : [r.variant_id]))
        ),
      ];

      const [makes, models, variants] = await Promise.all([
        supabase.from('makes').select('id, name, name_ur').in('id', makeIds),
        modelIds.length > 0
          ? supabase.from('models').select('id, name, name_ur').in('id', modelIds)
          : Promise.resolve({ data: [], error: null }),
        variantIds.length > 0
          ? supabase
              .from('variants')
              .select('id, name, name_ur')
              .in('id', variantIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (makes.error) throw makes.error;
      if (models.error) throw models.error;
      if (variants.error) throw variants.error;

      const makeById = new Map(makes.data.map((m) => [m.id, m]));
      const modelById = new Map(models.data.map((m) => [m.id, m]));
      const variantById = new Map(variants.data.map((v) => [v.id, v]));

      return rows.flatMap((row) => {
        const make = makeById.get(row.make_id);
        if (!make) return [];
        const model = row.model_id === null ? null : modelById.get(row.model_id);
        const variant =
          row.variant_id === null ? null : variantById.get(row.variant_id);
        return [
          {
            id: row.id,
            makeName: make.name,
            makeNameUr: make.name_ur,
            modelName: model?.name ?? null,
            modelNameUr: model?.name_ur ?? null,
            variantName: variant?.name ?? null,
            variantNameUr: variant?.name_ur ?? null,
          },
        ];
      });
    },
  });
}
