import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useAddBuyer, useAllowedBuyers } from '@/lib/queries/admin';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function AdminUsersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const buyers = useAllowedBuyers();
  const addBuyer = useAddBuyer();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  const canAdd = phone.trim().length > 0 && name.trim().length > 0 && !addBuyer.isPending;

  async function submit() {
    if (!canAdd) return;
    try {
      await addBuyer.mutateAsync({ phone, name });
      setPhone('');
      setName('');
    } catch {
      // Error text is rendered below from addBuyer.error
    }
  }

  const errorKey =
    addBuyer.error instanceof Error && addBuyer.error.message === 'DUPLICATE_PHONE'
      ? 'admin.duplicatePhone'
      : addBuyer.error instanceof Error && addBuyer.error.message === 'INVALID_PHONE'
        ? 'admin.invalidPhone'
        : addBuyer.isError
          ? 'common.error'
          : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()}>
          <AppText weight="600" style={styles.back}>
            {t('admin.back')}
          </AppText>
        </Pressable>
        <AppText variant="title" weight="700">
          {t('admin.buyers')}
        </AppText>
        <AppText style={styles.muted}>{t('admin.buyersHelp')}</AppText>

        <AppText variant="caption" weight="600">
          {t('auth.phone')}
        </AppText>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder={t('auth.phonePlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.field}
        />
        <AppText variant="caption" weight="600">
          {t('profile.contactName')}
        </AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('admin.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={styles.field}
        />
        {errorKey ? (
          <AppText variant="caption" style={styles.error}>
            {t(errorKey)}
          </AppText>
        ) : null}
        <Pressable
          disabled={!canAdd}
          onPress={() => void submit()}
          style={[styles.button, !canAdd ? styles.disabled : null]}
        >
          {addBuyer.isPending ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <AppText weight="600" style={styles.buttonText}>
              {t('admin.addBuyer')}
            </AppText>
          )}
        </Pressable>

        <AppText weight="600" style={styles.listTitle}>
          {t('admin.buyerList')}
        </AppText>
        {buyers.isPending ? (
          <ActivityIndicator color={colors.accent} />
        ) : (buyers.data ?? []).length === 0 ? (
          <AppText style={styles.muted}>{t('admin.noBuyers')}</AppText>
        ) : (
          (buyers.data ?? []).map((row) => (
            <View key={row.id} style={styles.card}>
              <AppText weight="600">{row.contact_name ?? t('profile.missing')}</AppText>
              <AppText variant="caption" style={styles.muted}>
                {row.phone}
              </AppText>
            </View>
          ))
        )}
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
      gap: 10,
    },
    back: { color: colors.primary },
    muted: { color: colors.textSecondary },
    field: {
      minHeight: 48,
      paddingStart: 14,
      paddingEnd: 14,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
    },
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
    listTitle: { marginTop: 12 },
    card: {
      padding: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 4,
    },
  });
}
