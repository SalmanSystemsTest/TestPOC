import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function AdminHomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  return (
    <Screen>
      <AppText variant="title" weight="700">
        {t('admin.title')}
      </AppText>
      <AppText style={styles.muted}>{t('admin.subtitle')}</AppText>
      <View style={styles.list}>
        <AdminLink
          icon="person-add-outline"
          label={t('admin.buyers')}
          onPress={() => router.push('/admin/users')}
          colors={colors}
        />
        <AdminLink
          icon="cloud-upload-outline"
          label={t('admin.catalogue')}
          onPress={() => router.push('/admin/upload')}
          colors={colors}
        />
      </View>
    </Screen>
  );
}

function AdminLink({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <AppText weight="600" style={styles.rowLabel}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    muted: { color: colors.textSecondary, marginTop: 8, marginBottom: 20 },
    list: { gap: 10 },
    row: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingStart: 14,
      paddingEnd: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowLabel: { flex: 1, color: colors.textPrimary },
  });
}
