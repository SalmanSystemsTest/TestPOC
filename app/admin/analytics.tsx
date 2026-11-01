import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminBreakdownTable } from '@/components/AdminBreakdownTable';
import { AppText } from '@/components/AppText';
import { formatPkr } from '@/lib/format';
import { useAdminAnalytics } from '@/lib/queries/admin-analytics';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function AdminAnalyticsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const analytics = useAdminAnalytics();

  const data = analytics.data;

  function displayLabel(label: string): string {
    return label === '__unset__' ? t('admin.cityUnknown') : label;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={analytics.isRefetching}
            onRefresh={() => void analytics.refetch()}
            tintColor={colors.accent}
          />
        }
      >
        <Pressable onPress={() => router.back()}>
          <AppText weight="600" style={styles.back}>
            {t('admin.back')}
          </AppText>
        </Pressable>
        <AppText variant="title" weight="700">
          {t('admin.analyticsTitle')}
        </AppText>
        <AppText style={styles.muted}>{t('admin.analyticsHelp')}</AppText>

        {analytics.isPending ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : analytics.isError ? (
          <AppText style={styles.error}>{t('admin.analyticsUnavailable')}</AppText>
        ) : data ? (
          <>
            <AppText weight="700" style={styles.section}>
              {t('admin.analyticsCatalogue')}
            </AppText>
            <View style={styles.kpiGrid}>
              <KpiCard
                label={t('admin.kpiActiveParts')}
                value={String(data.catalogue.activeParts)}
                colors={colors}
              />
              <KpiCard
                label={t('admin.kpiMakes')}
                value={String(data.catalogue.distinctMakes)}
                colors={colors}
              />
              <KpiCard
                label={t('admin.kpiBrands')}
                value={String(data.catalogue.distinctBrands)}
                colors={colors}
              />
              <KpiCard
                label={t('admin.kpiInactiveParts')}
                value={String(data.catalogue.inactiveParts)}
                colors={colors}
              />
            </View>

            <AdminBreakdownTable
              title={t('admin.tableTopMakes')}
              nameHeader={t('admin.colMake')}
              countHeader={t('admin.colParts')}
              rows={data.catalogue.topMakes}
              emptyLabel={t('admin.noBreakdownData')}
            />
            <AdminBreakdownTable
              title={t('admin.tableTopGroups')}
              nameHeader={t('admin.colGroup')}
              countHeader={t('admin.colParts')}
              rows={data.catalogue.topGroups}
              emptyLabel={t('admin.noBreakdownData')}
            />
            <AdminBreakdownTable
              title={t('admin.tableTopBrands')}
              nameHeader={t('admin.colBrand')}
              countHeader={t('admin.colParts')}
              rows={data.catalogue.topBrands}
              emptyLabel={t('admin.noBreakdownData')}
            />
            <AdminBreakdownTable
              title={t('admin.tableTopOrigins')}
              nameHeader={t('admin.colOrigin')}
              countHeader={t('admin.colParts')}
              rows={data.catalogue.topOrigins}
              emptyLabel={t('admin.noBreakdownData')}
            />

            <AppText weight="700" style={styles.section}>
              {t('admin.analyticsUsers')}
            </AppText>
            <View style={styles.kpiGrid}>
              <KpiCard
                label={t('admin.kpiActiveBuyers')}
                value={String(data.users.activeBuyers)}
                colors={colors}
              />
              <KpiCard
                label={t('admin.kpiAllowlisted')}
                value={String(data.users.allowlistedBuyers)}
                colors={colors}
              />
              <KpiCard
                label={t('admin.kpiWithCity')}
                value={String(data.users.registeredWithCity)}
                colors={colors}
              />
              <KpiCard
                label={t('admin.kpiFavourites')}
                value={String(data.engagement.favourites)}
                colors={colors}
              />
            </View>

            <AdminBreakdownTable
              title={t('admin.tableBuyersByCity')}
              nameHeader={t('admin.colCity')}
              countHeader={t('admin.colBuyers')}
              rows={data.users.byCity.map((row) => ({
                ...row,
                label: displayLabel(row.label),
              }))}
              emptyLabel={t('admin.noBreakdownData')}
            />

            <AppText weight="700" style={styles.section}>
              {t('admin.analyticsRequests')}
            </AppText>
            <View style={styles.kpiGrid}>
              <KpiCard
                label={t('admin.kpiQuotesTotal')}
                value={String(data.engagement.quoteRequestsTotal)}
                colors={colors}
              />
              <KpiCard
                label={t('admin.kpiQuotes30d')}
                value={String(data.engagement.quoteRequestsLast30Days)}
                colors={colors}
              />
              <KpiCard
                label={t('admin.kpiCartLines')}
                value={String(data.engagement.cartLines)}
                colors={colors}
              />
              <KpiCard
                label={t('admin.kpiQuoteValue')}
                value={formatPkr(data.engagement.quoteIndicativeTotalPkr)}
                colors={colors}
              />
            </View>

            <View style={styles.card}>
              <AppText weight="700" style={styles.cardTitle}>
                {t('admin.recentQuotes')}
              </AppText>
              {data.engagement.recentQuotes.length === 0 ? (
                <AppText variant="caption" style={styles.muted}>
                  {t('admin.noRecentQuotes')}
                </AppText>
              ) : (
                data.engagement.recentQuotes.map((row) => (
                  <View key={row.reference} style={styles.quoteRow}>
                    <View style={styles.quoteMain}>
                      <AppText weight="600">{row.reference}</AppText>
                      <AppText variant="caption" style={styles.muted}>
                        {displayLabel(row.buyer_label)}
                      </AppText>
                    </View>
                    <View style={styles.quoteMeta}>
                      <AppText variant="caption" weight="600">
                        {formatPkr(row.total_pkr)}
                      </AppText>
                      <AppText variant="caption" style={styles.muted}>
                        {t('admin.quoteLineCount', { count: row.item_count })}
                      </AppText>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.kpi}>
      <AppText variant="caption" style={styles.kpiLabel}>
        {label}
      </AppText>
      <AppText weight="700" style={styles.kpiValue}>
        {value}
      </AppText>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingStart: 16,
      paddingEnd: 16,
      paddingTop: 8,
      paddingBottom: 32,
      gap: 12,
    },
    back: { color: colors.primary, marginBottom: 4 },
    muted: { color: colors.textSecondary },
    section: { color: colors.textPrimary, marginTop: 8 },
    loader: { marginTop: 24 },
    error: { color: colors.danger },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    kpi: {
      width: '47%',
      flexGrow: 1,
      minWidth: 140,
      padding: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 4,
    },
    kpiLabel: { color: colors.textSecondary },
    kpiValue: { color: colors.textPrimary, fontSize: 18 },
    card: {
      padding: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 10,
    },
    cardTitle: { color: colors.textPrimary },
    quoteRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    quoteMain: { flex: 1, gap: 2 },
    quoteMeta: { alignItems: 'flex-end', gap: 2 },
  });
}
