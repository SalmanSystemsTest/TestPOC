import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalisePhone } from '../auth';
import { supabase } from '../supabase';
import type { Tables } from '../../types/database';

export type AllowedUser = Tables<'allowed_users'>;

export type ImportSummary = {
  rowsRead: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export function useAllowedBuyers() {
  return useQuery({
    queryKey: ['admin', 'buyers'],
    queryFn: async (): Promise<AllowedUser[]> => {
      const { data, error } = await supabase
        .from('allowed_users')
        .select('*')
        .eq('role', 'buyer')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { phone: string; name: string }) => {
      const phone = normalisePhone(params.phone);
      const contact_name = params.name.trim();
      if (phone.length < 11) throw new Error('INVALID_PHONE');
      if (!contact_name) throw new Error('INVALID_NAME');

      const { error } = await supabase.from('allowed_users').insert({
        phone,
        contact_name,
        role: 'buyer',
      });
      if (error) {
        if (error.code === '23505') throw new Error('DUPLICATE_PHONE');
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'buyers'] });
    },
  });
}

export function useImportCatalogue() {
  return useMutation({
    mutationFn: async (file: { uri: string; name: string }): Promise<ImportSummary> => {
      const response = await fetch(file.uri);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const path = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('imports')
        .upload(path, bytes, {
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.functions.invoke('import-parts', {
        body: { path },
      });
      if (error) throw error;
      return data as ImportSummary;
    },
  });
}
