// Server-side queries for the signed-in user's profile.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type Profile = Tables<'profiles'>;

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: typeof userId === 'string',
    queryFn: async (): Promise<Profile | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCompleteProfile(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      contactName: string;
      businessName: string;
      city: string;
      address: string;
      preferredMakes: string[];
      preferredGroups: string[];
    }) => {
      if (!userId) throw new Error('Not signed in');
      const { data, error } = await supabase
        .from('profiles')
        .update({
          contact_name: params.contactName.trim(),
          business_name: params.businessName.trim(),
          city: params.city.trim(),
          address: params.address.trim(),
          preferred_makes: params.preferredMakes,
          preferred_groups: params.preferredGroups,
        })
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile', userId], data);
    },
  });
}

export function useUpdateProfileLanguage(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (language: 'en' | 'ur') => {
      if (!userId) throw new Error('Not signed in');
      const { error } = await supabase
        .from('profiles')
        .update({ language })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });
}
