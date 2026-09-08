import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useAuthSession } from '@/lib/auth-context';
import { signOut } from '@/lib/auth';
import { config, hasWhatsapp } from '@/lib/config';
import { useLanguage, type LanguageCode } from '@/lib/i18n';
import {
  useProfile,
  useUpdateProfileLanguage,
} from '@/lib/queries/profile';
import {
  useTheme,
  type ThemeColors,
  type ThemePreference,
} from '@/lib/theme';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors, preference, setPreference } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { session } = useAuthSession();
  const router = useRouter();
  const styles = makeStyles(colors);
  const userId = session?.user.id;
  const profile = useProfile(userId);
  const updateLanguage = useUpdateProfileLanguage(userId);

  const switchLanguage = async (next: LanguageCode) => {
    await updateLanguage.mutateAsync(next);
    await setLanguage(next);
  };

  const contactSsg = () => {
    if (hasWhatsapp && config.ssgWhatsapp) {
      void Linking.openURL(`https://wa.me/${config.ssgWhatsapp}`);
      return;
    }
    if (config.ssgPhone) {
      void Linking.openURL(`tel:${config.ssgPhone}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" weight="700">
          {t('profile.title')}
        </AppText>

        {profile.isPending ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : profile.isError || !profile.data ? (
          <AppText style={styles.muted}>{t('common.error')}</AppText>
        ) : (
          <>
            <View style={styles.identityCard}>
              <View style={styles.avatar}>
                <Ionicons name="business" size={28} color={colors.primary} />
              </View>
              <View style={styles.identity}>
                <AppText variant="title" weight="700" style={styles.business}>
                  {profile.data.business_name ?? t('profile.missing')}
                </AppText>
                <View style={styles.verified}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.success}
                  />
                  <AppText variant="caption" weight="600" style={styles.success}>
                    {t('profile.verified')}
                  </AppText>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <InfoRow
                label={t('profile.contactName')}
                value={profile.data.contact_name ?? t('profile.missing')}
                colors={colors}
              />
              <InfoRow
                label={t('profile.identifier')}
                value={
                  profile.data.email ??
                  profile.data.phone ??
                  t('profile.missing')
                }
                colors={colors}
              />
              <InfoRow
                label={t('profile.city')}
                value={profile.data.city ?? t('profile.missing')}
                colors={colors}
              />
              <InfoRow
                label={t('profile.address')}
                value={profile.data.address ?? t('profile.missing')}
                colors={colors}
              />
            </View>

            <AppText variant="caption" weight="600" style={styles.sectionLabel}>
              {t('profile.settings')}
            </AppText>

            <View style={styles.card}>
              <SettingBlock
                icon="language-outline"
                title={t('profile.language')}
                colors={colors}
              >
                <ChoiceRow
                  options={[
                    { id: 'en', label: t('language.english') },
                    { id: 'ur', label: t('language.urdu') },
                  ]}
                  selected={language ?? 'en'}
                  onSelect={(id) => void switchLanguage(id as LanguageCode)}
                  colors={colors}
                />
              </SettingBlock>

              <View style={styles.separator} />

              <SettingBlock
                icon="contrast-outline"
                title={t('profile.appearance')}
                colors={colors}
              >
                <ChoiceRow
                  options={[
                    { id: 'system', label: t('profile.system') },
                    { id: 'light', label: t('profile.light') },
                    { id: 'dark', label: t('profile.dark') },
                  ]}
                  selected={preference}
                  onSelect={(id) =>
                    void setPreference(id as ThemePreference)
                  }
                  colors={colors}
                />
              </SettingBlock>
            </View>

            <View style={styles.card}>
              <ActionRow
                icon="call-outline"
                label={t('profile.contact')}
                onPress={contactSsg}
                disabled={!hasWhatsapp && !config.ssgPhone}
                colors={colors}
              />
              {profile.data.role === 'admin' ? (
                <>
                  <View style={styles.separator} />
                  <ActionRow
                    icon="shield-outline"
                    label={t('profile.adminHome')}
                    onPress={() => router.push('/admin' as Href)}
                    colors={colors}
                  />
                  <View style={styles.separator} />
                  <ActionRow
                    icon="people-outline"
                    label={t('profile.adminBuyers')}
                    onPress={() => router.push('/admin/users')}
                    colors={colors}
                  />
                  <View style={styles.separator} />
                  <ActionRow
                    icon="cloud-upload-outline"
                    label={t('profile.adminUpload')}
                    onPress={() => router.push('/admin/upload')}
                    colors={colors}
                  />
                </>
              ) : null}
              <View style={styles.separator} />
              <ActionRow
                icon="log-out-outline"
                label={t('profile.signOut')}
                onPress={() => void signOut()}
                danger
                colors={colors}
              />
            </View>

            {!hasWhatsapp && !config.ssgPhone ? (
              <AppText variant="caption" style={styles.muted}>
                {t('profile.contactUnavailable')}
              </AppText>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
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
    <View style={styles.infoRow}>
      <AppText variant="caption" style={styles.muted}>
        {label}
      </AppText>
      <AppText weight="500">{value}</AppText>
    </View>
  );
}

function SettingBlock({
  icon,
  title,
  children,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.setting}>
      <View style={styles.settingTitle}>
        <Ionicons name={icon} size={19} color={colors.textSecondary} />
        <AppText weight="600">{title}</AppText>
      </View>
      {children}
    </View>
  );
}

function ChoiceRow({
  options,
  selected,
  onSelect,
  colors,
}: {
  options: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.choices}>
      {options.map((option) => {
        const active = option.id === selected;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={[styles.choice, active && styles.choiceActive]}
          >
            <AppText
              variant="caption"
              weight={active ? '600' : '400'}
              style={active ? styles.choiceTextActive : styles.muted}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  disabled,
  danger,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  const color = danger ? colors.danger : colors.textPrimary;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <AppText
        weight="500"
        style={[styles.actionText, danger ? styles.danger : null]}
      >
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
    </Pressable>
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
      gap: 16,
    },
    loader: { marginTop: 48 },
    identityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.accentBackground,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    identity: { flex: 1, gap: 4 },
    business: { fontSize: 20 },
    verified: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    success: { color: colors.success },
    card: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    infoRow: {
      gap: 4,
      paddingStart: 14,
      paddingEnd: 14,
      paddingTop: 11,
      paddingBottom: 11,
    },
    sectionLabel: {
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    setting: { gap: 10, padding: 14 },
    settingTitle: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    choices: {
      flexDirection: 'row',
      padding: 3,
      borderRadius: 10,
      backgroundColor: colors.surfaceAlt,
    },
    choice: {
      flex: 1,
      minHeight: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
    },
    choiceActive: { backgroundColor: colors.surface },
    choiceTextActive: { color: colors.primary },
    separator: {
      height: StyleSheet.hairlineWidth,
      marginStart: 14,
      marginEnd: 14,
      backgroundColor: colors.border,
    },
    action: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingStart: 14,
      paddingEnd: 14,
    },
    actionText: { flex: 1 },
    danger: { color: colors.danger },
    muted: { color: colors.textSecondary },
    disabled: { opacity: 0.45 },
  });
}
