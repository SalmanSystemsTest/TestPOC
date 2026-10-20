import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
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
import { useImportCatalogue } from '@/lib/queries/admin';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function AdminUploadScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const importCatalogue = useImportCatalogue();

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    await importCatalogue.mutateAsync({
      uri: file.uri,
      name: file.name ?? 'catalogue.xlsx',
    });
  }

  const summary = importCatalogue.data;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <AppText weight="600" style={styles.back}>
            {t('admin.back')}
          </AppText>
        </Pressable>
        <AppText variant="title" weight="700">
          {t('admin.catalogue')}
        </AppText>
        <AppText style={styles.muted}>{t('admin.importHelp')}</AppText>

        <View style={styles.card}>
          <AppText weight="600">{t('admin.partsSheet')}</AppText>
          <AppText variant="caption" style={styles.muted}>
            {t('admin.partsColumns')}
          </AppText>
          <AppText weight="600" style={styles.block}>
            {t('admin.fitmentSheet')}
          </AppText>
          <AppText variant="caption" style={styles.muted}>
            {t('admin.fitmentColumns')}
          </AppText>
          <AppText variant="caption" style={styles.muted}>
            {t('admin.categories')}
          </AppText>
        </View>

        <Pressable
          disabled={importCatalogue.isPending}
          onPress={() => void pickFile()}
          style={[styles.button, importCatalogue.isPending ? styles.disabled : null]}
        >
          {importCatalogue.isPending ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <AppText weight="600" style={styles.buttonText}>
              {t('admin.pickFile')}
            </AppText>
          )}
        </Pressable>

        {importCatalogue.isError ? (
          <AppText style={styles.error}>{t('admin.importFailed')}</AppText>
        ) : null}

        {summary ? (
          <View style={styles.card}>
            <AppText weight="600">{t('admin.importResult')}</AppText>
            <AppText style={styles.muted}>
              {t('admin.importCounts', {
                read: summary.rowsRead,
                created: summary.created,
                updated: summary.updated,
                removed: summary.removed,
                skipped: summary.skipped,
              })}
            </AppText>
            {summary.errors.map((error) => (
              <AppText key={error} variant="caption" style={styles.error}>
                {error}
              </AppText>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
    back: { color: colors.primary },
    muted: { color: colors.textSecondary },
    card: {
      padding: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 8,
    },
    block: { marginTop: 6 },
    button: {
      minHeight: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    buttonText: { color: colors.accentText },
    disabled: { opacity: 0.55 },
    error: { color: colors.danger },
  });
}
