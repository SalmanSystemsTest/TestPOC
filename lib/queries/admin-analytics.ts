import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';

export type AnalyticsBreakdownRow = {
  label: string;
  count: number;
};

export type RecentQuoteRow = {
  reference: string;
  created_at: string | null;
  item_count: number;
  total_pkr: number;
  buyer_label: string;
};

export type AdminAnalytics = {
  catalogue: {
    activeParts: number;
    inactiveParts: number;
    distinctMakes: number;
    distinctBrands: number;
    topMakes: AnalyticsBreakdownRow[];
    topGroups: AnalyticsBreakdownRow[];
    topBrands: AnalyticsBreakdownRow[];
    topOrigins: AnalyticsBreakdownRow[];
  };
  users: {
    activeBuyers: number;
    allowlistedBuyers: number;
    byCity: AnalyticsBreakdownRow[];
    registeredWithCity: number;
  };
  engagement: {
    favourites: number;
    cartLines: number;
    quoteRequestsTotal: number;
    quoteRequestsLast30Days: number;
    quoteIndicativeTotalPkr: number;
    recentQuotes: RecentQuoteRow[];
  };
};

function parseBreakdown(value: unknown): AnalyticsBreakdownRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return [];
    const label = 'label' in row ? String(row.label) : '';
    const count = 'count' in row ? Number(row.count) : 0;
    if (!label) return [];
    return [{ label, count: Number.isFinite(count) ? count : 0 }];
  });
}

function parseRecentQuotes(value: unknown): RecentQuoteRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return [];
    const reference = 'reference' in row ? String(row.reference) : '';
    if (!reference) return [];
    return [
      {
        reference,
        created_at:
          'created_at' in row && row.created_at != null
            ? String(row.created_at)
            : null,
        item_count: Number('item_count' in row ? row.item_count : 0) || 0,
        total_pkr: Number('total_pkr' in row ? row.total_pkr : 0) || 0,
        buyer_label:
          'buyer_label' in row ? String(row.buyer_label) : '(unknown)',
      },
    ];
  });
}

function parseAnalytics(raw: unknown): AdminAnalytics {
  const root = typeof raw === 'object' && raw !== null ? raw : {};
  const catalogue =
    'catalogue' in root && typeof root.catalogue === 'object' && root.catalogue
      ? root.catalogue
      : {};
  const users =
    'users' in root && typeof root.users === 'object' && root.users ? root.users : {};
  const engagement =
    'engagement' in root && typeof root.engagement === 'object' && root.engagement
      ? root.engagement
      : {};

  const num = (obj: object, key: string): number => {
    if (!(key in obj)) return 0;
    const v = Number(obj[key as keyof typeof obj]);
    return Number.isFinite(v) ? v : 0;
  };

  return {
    catalogue: {
      activeParts: num(catalogue, 'activeParts'),
      inactiveParts: num(catalogue, 'inactiveParts'),
      distinctMakes: num(catalogue, 'distinctMakes'),
      distinctBrands: num(catalogue, 'distinctBrands'),
      topMakes: parseBreakdown('topMakes' in catalogue ? catalogue.topMakes : []),
      topGroups: parseBreakdown('topGroups' in catalogue ? catalogue.topGroups : []),
      topBrands: parseBreakdown('topBrands' in catalogue ? catalogue.topBrands : []),
      topOrigins: parseBreakdown('topOrigins' in catalogue ? catalogue.topOrigins : []),
    },
    users: {
      activeBuyers: num(users, 'activeBuyers'),
      allowlistedBuyers: num(users, 'allowlistedBuyers'),
      byCity: parseBreakdown('byCity' in users ? users.byCity : []),
      registeredWithCity: num(users, 'registeredWithCity'),
    },
    engagement: {
      favourites: num(engagement, 'favourites'),
      cartLines: num(engagement, 'cartLines'),
      quoteRequestsTotal: num(engagement, 'quoteRequestsTotal'),
      quoteRequestsLast30Days: num(engagement, 'quoteRequestsLast30Days'),
      quoteIndicativeTotalPkr: num(engagement, 'quoteIndicativeTotalPkr'),
      recentQuotes: parseRecentQuotes(
        'recentQuotes' in engagement ? engagement.recentQuotes : [],
      ),
    },
  };
}

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: async (): Promise<AdminAnalytics> => {
      const { data, error } = await supabase.rpc('get_admin_analytics');
      if (error) throw error;
      return parseAnalytics(data);
    },
    staleTime: 60_000,
  });
}
