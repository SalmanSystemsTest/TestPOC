import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import type { AnalyticsBreakdownRow } from '@/lib/queries/admin-analytics';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  title: string;
  nameHeader: string;
  rows: AnalyticsBreakdownRow[];
  emptyLabel: string;
  countHeader: string;
};

export function AdminBreakdownTable({
  title,
  nameHeader,
  rows,
  emptyLabel,
  countHeader,
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;

  return (
    <View style={styles.card}>
      <AppText weight="700" style={styles.title}>
        {title}
      </AppText>
      <View style={styles.headerRow}>
        <AppText variant="caption" weight="600" style={styles.headerLabel}>
          {nameHeader}
        </AppText>
        <AppText variant="caption" weight="600" style={styles.headerCount}>
          {countHeader}
        </AppText>
      </View>
      {rows.length === 0 ? (
        <AppText variant="caption" style={styles.empty}>
          {emptyLabel}
        </AppText>
      ) : (
        rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <View style={styles.rowText}>
              <AppText weight="600" numberOfLines={1}>
                {row.label}
              </AppText>
              <AppText variant="caption" style={styles.count}>
                {row.count}
              </AppText>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { width: `${Math.round((row.count / max) * 100)}%` }]}
              />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      padding: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 8,
    },
    title: { color: colors.textPrimary, marginBottom: 2 },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerLabel: { color: colors.textMuted, flex: 1 },
    headerCount: { color: colors.textMuted, minWidth: 48, textAlign: 'right' },
    empty: { color: colors.textSecondary },
    row: { gap: 4, paddingTop: 4 },
    rowText: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    count: { color: colors.textSecondary },
    barTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    barFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      minWidth: 4,
    },
  });
}
