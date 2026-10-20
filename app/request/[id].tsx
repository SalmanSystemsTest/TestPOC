import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useAuthSession } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { useRequest } from '@/lib/queries/requests';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { session } = useAuthSession();
  const request = useRequest(session?.user.id, id);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.textPrimary}
          />
        </Pressable>
        <AppText weight="700">{t('requests.detailTitle')}</AppText>
        <View style={styles.headerSpacer} />
      </View>

      {request.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : request.isError || !request.data ? (
        <View style={styles.center}>
          <AppText style={styles.muted}>{t('requests.notFound')}</AppText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summary}>
            <AppText variant="caption" style={styles.muted}>
              {t('requests.reference')}
            </AppText>
            <AppText variant="title" weight="700">
              {request.data.request.reference}
            </AppText>
            {request.data.request.created_at ? (
              <AppText variant="caption" style={styles.muted}>
                {t('requests.submitted', {
                  date: formatDate(request.data.request.created_at),
                })}
              </AppText>
            ) : null}
            <View style={styles.summaryRow}>
              <AppText>{t('requests.items', { count: request.data.request.item_count })}</AppText>
            </View>
          </View>

          <AppText variant="caption" weight="600" style={styles.sectionLabel}>
            {t('requests.lineItems')}
          </AppText>
          <View style={styles.items}>
            {request.data.items.map((item) => (
              <View key={item.id} style={styles.item}>
                <View style={styles.itemMain}>
                  <AppText weight="600">{item.name_snapshot}</AppText>
                  <AppText variant="caption" style={styles.muted}>
                    {[item.brand_snapshot, item.oem_snapshot]
                      .filter(Boolean)
                      .join(' · ')}
                  </AppText>
                  <AppText variant="caption" style={styles.muted}>
                    {t('requests.quantity', { count: item.qty })}
                  </AppText>
                </View>
              </View>
            ))}
          </View>

          {request.data.request.note ? (
            <View style={styles.note}>
              <AppText variant="caption" weight="600">
                {t('requests.note')}
              </AppText>
              <AppText>{request.data.request.note}</AppText>
            </View>
          ) : null}

          <View style={styles.readOnly}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textSecondary}
            />
            <AppText variant="caption" style={styles.readOnlyText}>
              {t('requests.readOnly')}
            </AppText>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingStart: 12,
      paddingEnd: 12,
    },
    headerSpacer: { width: 24 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: {
      paddingStart: 16,
      paddingEnd: 16,
      paddingBottom: 32,
      gap: 14,
    },
    summary: {
      gap: 6,
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.accentBackground,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    sectionLabel: {
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    items: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    item: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      padding: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemMain: { flex: 1, gap: 3 },
    total: { color: colors.primary },
    muted: { color: colors.textSecondary },
    note: {
      gap: 8,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    readOnly: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      padding: 12,
    },
    readOnlyText: { flex: 1, color: colors.textSecondary },
  });
}
