import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/Screen';
import { useTheme, type ThemeColors } from '@/lib/theme';

export function EmptyState() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <Screen>
      <View style={styles.card}>
        <AppText variant="title">{t('empty.title')}</AppText>
        <AppText style={styles.body}>{t('empty.body')}</AppText>
      </View>
    </Screen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      marginTop: 24,
      padding: 20,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      gap: 8,
    },
    body: {
      color: colors.textSecondary,
    },
  });
}
