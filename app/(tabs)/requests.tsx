import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useAuthSession } from '@/lib/auth-context';
import { formatDate } from '@/lib/format';
import { useRequests } from '@/lib/queries/requests';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function RequestsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { session } = useAuthSession();
  const requests = useRequests(session?.user.id);

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={requests.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <AppText variant="title" weight="700" style={styles.heading}>
            {t('requests.title')}
          </AppText>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/request/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <View>
                <AppText variant="caption" style={styles.muted}>
                  {t('requests.reference')}
                </AppText>
                <AppText weight="700">{item.reference}</AppText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </View>
            <View style={styles.meta}>
              <AppText variant="caption" style={styles.muted}>
                {item.created_at ? formatDate(item.created_at) : ''}
              </AppText>
              <AppText variant="caption" style={styles.muted}>
                {t('requests.items', { count: item.item_count })}
              </AppText>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          requests.isPending ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Ionicons
                name="document-text-outline"
                size={44}
                color={colors.textMuted}
              />
              <AppText variant="title" weight="600">
                {requests.isError ? t('common.error') : t('requests.empty')}
              </AppText>
              {!requests.isError ? (
                <AppText style={[styles.muted, styles.center]}>
                  {t('requests.emptyBody')}
                </AppText>
              ) : null}
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingStart: 16,
      paddingEnd: 16,
      paddingBottom: 28,
      gap: 12,
    },
    heading: { paddingTop: 8, paddingBottom: 6 },
    card: {
      gap: 12,
      padding: 16,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    meta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    total: { color: colors.primary },
    muted: { color: colors.textSecondary },
    loader: { marginTop: 48 },
    empty: { alignItems: 'center', gap: 8, paddingTop: 56 },
    center: { textAlign: 'center' },
  });
}
