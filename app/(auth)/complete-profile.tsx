import { Redirect, type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BrandLogo } from '@/components/BrandLogo';
import { useAuthSession } from '@/lib/auth-context';
import { useCompleteProfile, useProfile } from '@/lib/queries/profile';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function CompleteProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const profile = useProfile(userId);
  const complete = useCompleteProfile(userId);
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !profile.data) return;
    setBusinessName(profile.data.business_name ?? '');
    setCity(profile.data.city ?? '');
    setAddress(profile.data.address ?? '');
    setPrefilled(true);
  }, [prefilled, profile.data]);

  if (!session) {
    return <Redirect href={'/(auth)/sign-in' as Href} />;
  }

  const canSubmit =
    businessName.trim().length > 0 &&
    city.trim().length > 0 &&
    address.trim().length > 0 &&
    !complete.isPending;

  async function submit() {
    if (!canSubmit) return;
    await complete.mutateAsync({ businessName, city, address });
    router.replace('/(tabs)' as Href);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <BrandLogo />
        <AppText weight="600" style={styles.heading}>
          {t('onboard.title')}
        </AppText>
        <AppText style={styles.subtitle}>
          {t('onboard.subtitle', {
            name: profile.data?.contact_name ?? '',
          })}
        </AppText>

        <Field
          label={t('profile.businessName')}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder={t('onboard.businessPlaceholder')}
          colors={colors}
          styles={styles}
        />
        <Field
          label={t('profile.city')}
          value={city}
          onChangeText={setCity}
          placeholder={t('onboard.cityPlaceholder')}
          colors={colors}
          styles={styles}
        />
        <Field
          label={t('profile.address')}
          value={address}
          onChangeText={setAddress}
          placeholder={t('onboard.addressPlaceholder')}
          colors={colors}
          styles={styles}
          multiline
        />

        {complete.isError ? (
          <AppText style={styles.error}>{t('common.error')}</AppText>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={[styles.submit, !canSubmit ? styles.submitDisabled : null]}
        >
          {complete.isPending ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <AppText weight="600" style={styles.submitText}>
              {t('onboard.continue')}
            </AppText>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  styles,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldBlock}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={[styles.field, multiline ? styles.multiline : null]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      flex: 1,
      paddingTop: 38,
      paddingBottom: 28,
      paddingStart: 26,
      paddingEnd: 26,
      gap: 10,
    },
    heading: {
      color: colors.textPrimary,
      fontSize: 23,
      marginTop: 20,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 21,
      marginBottom: 12,
    },
    fieldBlock: { gap: 6 },
    label: { color: colors.textSecondary },
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
    multiline: { minHeight: 88, paddingTop: 12 },
    error: { color: colors.danger },
    submit: {
      minHeight: 48,
      marginTop: 8,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    submitDisabled: { opacity: 0.55 },
    submitText: { color: colors.accentText },
  });
}
