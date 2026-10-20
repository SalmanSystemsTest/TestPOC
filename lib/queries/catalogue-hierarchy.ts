import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Part } from './parts';
import { PAGE_SIZE } from './parts';

export type HierarchySelection = {
  makes: string[];
  groups: string[];
  subGroups: string[];
  brands: string[];
};

export const emptyHierarchySelection: HierarchySelection = {
  makes: [],
  groups: [],
  subGroups: [],
  brands: [],
};

export type HierarchyFilterOptions = {
  makes: string[];
  groups: string[];
  subGroups: string[];
  brands: string[];
};

function parseHierarchyOptions(raw: unknown): HierarchyFilterOptions {
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
  };
}

export function hierarchyHasSelection(selection: HierarchySelection): boolean {
  return (
    selection.makes.length > 0 ||
    selection.groups.length > 0 ||
    selection.subGroups.length > 0 ||
    selection.brands.length > 0
  );
}

export type HierarchyStep = 'make' | 'group' | 'subGroup' | 'brand';

type StepListKey = 'makes' | 'groups' | 'subGroups' | 'brands';

const STEP_LIST_KEY: Record<HierarchyStep, StepListKey> = {
  make: 'makes',
  group: 'groups',
  subGroup: 'subGroups',
  brand: 'brands',
};

function stepOptionsEnabled(step: HierarchyStep, committed: HierarchySelection): boolean {
  if (step === 'make') return true;
  if (step === 'group') return committed.makes.length > 0;
  if (step === 'subGroup') return committed.groups.length > 0;
  return committed.subGroups.length > 0;
}

/** Loads one hierarchy level from the server. Call when a step opens (after Continue), not on each tap. */
export function useHierarchyStepOptions(step: HierarchyStep, committed: HierarchySelection) {
  const listKey = STEP_LIST_KEY[step];
  const pMakes = step === 'make' ? null : committed.makes;
  const pGroups = step === 'make' || step === 'group' ? null : committed.groups;
  const pSubGroups =
    step === 'brand' ? committed.subGroups : null;

  return useQuery({
    queryKey: [
      'catalogue',
      'hierarchy-step',
      step,
      pMakes,
      pGroups,
      pSubGroups,
    ],
    enabled: stepOptionsEnabled(step, committed),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('get_hierarchical_catalogue_options', {
        p_makes: pMakes && pMakes.length > 0 ? pMakes : null,
        p_groups: pGroups && pGroups.length > 0 ? pGroups : null,
        p_sub_groups: pSubGroups && pSubGroups.length > 0 ? pSubGroups : null,
      });
      if (error) throw error;
      return parseHierarchyOptions(data)[listKey];
    },
    staleTime: 10 * 60 * 1000,
    placeholderData: (previous) => previous,
  });
}

export type HierarchyPartFilters = {
  query: string;
  selection: HierarchySelection;
};

async function fetchHierarchyPartsPage(
  filters: HierarchyPartFilters,
  offset: number
): Promise<Part[]> {
  const trimmed = filters.query.trim();
  const s = filters.selection;
  const { data, error } = await supabase.rpc('search_parts_catalogue', {
    p_query: trimmed.length > 0 ? trimmed : null,
    p_make_names: s.makes.length > 0 ? s.makes : null,
    p_group_names: s.groups.length > 0 ? s.groups : null,
    p_sub_group_names: s.subGroups.length > 0 ? s.subGroups : null,
    p_brands: s.brands.length > 0 ? s.brands : null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;
  return data ?? [];
}

export function useHierarchyPartsSearch(filters: HierarchyPartFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['parts', 'hierarchy', filters],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchHierarchyPartsPage(filters, pageParam),
    getNextPageParam: (lastPage: Part[], allPages: Part[][]) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    staleTime: 2 * 60 * 1000,
  });
}
