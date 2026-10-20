import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type CatalogueFilterOptions = {
  makes: string[];
  groups: string[];
  subGroups: string[];
  brands: string[];
  catModels: string[];
  itemModels: string[];
};

export type CatalogueFilters = {
  makeName: string | null;
  groupName: string | null;
  subGroupName: string | null;
  brand: string | null;
  catModel: string | null;
  itemModel: string | null;
};

export const emptyCatalogueFilters: CatalogueFilters = {
  makeName: null,
  groupName: null,
  subGroupName: null,
  brand: null,
  catModel: null,
  itemModel: null,
};

export function hasCatalogueFilter(filters: CatalogueFilters): boolean {
  return Object.values(filters).some((value) => value !== null);
}

function parseOptions(raw: unknown): CatalogueFilterOptions {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const list = (key: string): string[] => {
    const value = obj[key];
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === 'string');
  };
  return {
    makes: list('makes'),
    groups: list('groups'),
    subGroups: list('subGroups'),
    brands: list('brands'),
    catModels: list('catModels'),
    itemModels: list('itemModels'),
  };
}

export function useCatalogueFilterOptions() {
  return useQuery({
    queryKey: ['catalogue', 'filter-options'],
    queryFn: async (): Promise<CatalogueFilterOptions> => {
      const { data, error } = await supabase.rpc('get_catalogue_filter_options');
      if (error) throw error;
      return parseOptions(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}
