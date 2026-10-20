import { Redirect, type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BrandLogo } from '@/components/BrandLogo';
import { PreferenceMultiPick } from '@/components/PreferenceMultiPick';
import { useAuthSession } from '@/lib/auth-context';
import { sortByBuyerPreference } from '@/lib/catalogue-preference-sort';
import { useCatalogueFilterOptions } from '@/lib/queries/catalogue-filters';
import { isProfileComplete } from '@/lib/profile-complete';
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
  const filterOptions = useCatalogueFilterOptions();
  const complete = useCompleteProfile(userId);

  const [contactName, setContactName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [preferredMakes, setPreferredMakes] = useState<string[]>([]);
  const [preferredGroups, setPreferredGroups] = useState<string[]>([]);
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (prefilled || !profile.data) return;
    setContactName(profile.data.contact_name ?? '');
    setBusinessName(profile.data.business_name ?? '');
    setCity(profile.data.city ?? '');
    setAddress(profile.data.address ?? '');
    setPreferredMakes(profile.data.preferred_makes ?? []);
    setPreferredGroups(profile.data.preferred_groups ?? []);
    setPrefilled(true);
  }, [prefilled, profile.data]);

  const makeOptions = useMemo(
    () => sortByBuyerPreference(filterOptions.data?.makes ?? [], []),
    [filterOptions.data?.makes]
  );
  const groupOptions = useMemo(
    () => sortByBuyerPreference(filterOptions.data?.groups ?? [], []),
    [filterOptions.data?.groups]
  );

  if (!session) {
    return <Redirect href={'/(auth)/sign-in' as Href} />;
  }

  if (profile.data && isProfileComplete(profile.data)) {
    return <Redirect href={'/(tabs)' as Href} />;
  }

  const canSubmit =
    contactName.trim().length > 0 &&
    businessName.trim().length > 0 &&
    city.trim().length > 0 &&
    address.trim().length > 0 &&
    !complete.isPending;

  async function submit() {
    if (!canSubmit) return;
    await complete.mutateAsync({
      contactName,
      businessName,
      city,
      address,
      preferredMakes,
      preferredGroups,
    });
    router.replace('/(tabs)/' as Href);
  }

  const welcomeName = profile.data?.contact_name?.trim() || session.user.email || '';

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <BrandLogo />
          <AppText weight="600" style={styles.heading}>
            {t('onboard.title')}
          </AppText>
          <AppText style={styles.subtitle}>
            {t('onboard.subtitle', { name: welcomeName })}
          </AppText>

          <Field
            label={t('profile.contactName')}
            value={contactName}
            onChangeText={setContactName}
            placeholder={t('onboard.namePlaceholder')}
            colors={colors}
            styles={styles}
          />
          <Field
            label={t('profile.businessName')}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder={t('onboard.businessPlaceholder')}
            colors={colors}
            styles={styles}
          />

          <View style={styles.section}>
            <AppText weight="600">{t('onboard.preferredMakes')}</AppText>
            <AppText variant="caption" style={styles.sectionHint}>
              {t('onboard.preferredHint')}
            </AppText>
            {filterOptions.isPending ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <PreferenceMultiPick
                options={makeOptions}
                selected={preferredMakes}
                onChange={setPreferredMakes}
              />
            )}
          </View>

          <View style={styles.section}>
            <AppText weight="600">{t('onboard.preferredGroups')}</AppText>
            <AppText variant="caption" style={styles.sectionHint}>
              {t('onboard.preferredHint')}
            </AppText>
            {filterOptions.isPending ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <PreferenceMultiPick
                options={groupOptions}
                selected={preferredGroups}
                onChange={setPreferredGroups}
              />
            )}
          </View>

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
        </ScrollView>
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
    flex: { flex: 1 },
    content: {
      paddingTop: 38,
      paddingBottom: 32,
      paddingStart: 26,
      paddingEnd: 26,
      gap: 12,
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
      marginBottom: 8,
    },
    section: {
      gap: 8,
    },
    sectionHint: {
      color: colors.textSecondary,
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
