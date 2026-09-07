import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { signInShape, startSignIn } from '@/lib/auth';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function submit() {
    if (!identifier.trim() || (signInShape.needsPassword && !password)) return;
    setSubmitting(true);
    setErrorKey(null);
    const result = await startSignIn({ identifier, password });
    setSubmitting(false);

    if (result.status === 'signed_in') {
      router.replace('/(tabs)' as Href);
    } else if (result.status === 'code_sent') {
      router.push({
        pathname: '/(auth)/verify',
        params: { identifier },
      } as Href);
    } else if (result.status === 'not_registered') {
      setErrorKey('auth.notRegistered');
    } else if (result.status === 'bad_credentials') {
      setErrorKey('auth.badCredentials');
    } else {
      setErrorKey('auth.genericError');
    }
  }

  const canSubmit =
    identifier.trim().length > 0 &&
    (!signInShape.needsPassword || password.length > 0) &&
    !submitting;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <View style={styles.logo}>
          <BrandLogo />
        </View>
        <AppText weight="600" style={styles.heading}>
          {t('auth.welcome')}
        </AppText>
        <AppText style={styles.subtitle}>{t('auth.subtitle')}</AppText>

        <AppText variant="caption" style={styles.label}>
          {t(signInShape.identifierType === 'email' ? 'auth.email' : 'auth.phone')}
        </AppText>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
          keyboardType={
            signInShape.identifierType === 'email' ? 'email-address' : 'phone-pad'
          }
          onChangeText={setIdentifier}
          placeholder={t(
            signInShape.identifierType === 'email'
              ? 'auth.emailPlaceholder'
              : 'auth.phonePlaceholder'
          )}
          placeholderTextColor={colors.textMuted}
          style={styles.field}
          value={identifier}
        />

        {signInShape.needsPassword ? (
          <>
            <AppText variant="caption" style={styles.label}>
              {t('auth.password')}
            </AppText>
            <TextInput
              autoCapitalize="none"
              editable={!submitting}
              onChangeText={setPassword}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.field}
              value={password}
            />
          </>
        ) : null}

        {errorKey ? <AppText style={styles.error}>{t(errorKey)}</AppText> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.submit,
            !canSubmit ? styles.submitDisabled : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <AppText weight="600" style={styles.submitText}>
              {t(signInShape.twoStep ? 'auth.sendCode' : 'auth.signIn')}
            </AppText>
          )}
        </Pressable>

        <View style={styles.invite}>
          <Ionicons name="lock-closed-outline" color={colors.textMuted} size={14} />
          <AppText variant="caption" style={styles.inviteText}>
            {t('auth.inviteOnly')}
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      paddingTop: 38,
      paddingBottom: 28,
      paddingStart: 26,
      paddingEnd: 26,
    },
    logo: {
      marginBottom: 24,
    },
    heading: {
      color: colors.textPrimary,
      fontSize: 23,
      lineHeight: 31,
      marginBottom: 4,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 21,
      marginBottom: 28,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 7,
    },
    field: {
      width: '100%',
      minHeight: 48,
      paddingVertical: 13,
      paddingStart: 14,
      paddingEnd: 14,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      marginBottom: 16,
    },
    error: {
      color: colors.danger,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 14,
    },
    submit: {
      width: '100%',
      minHeight: 50,
      borderRadius: 12,
      padding: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      marginTop: 8,
    },
    submitDisabled: {
      opacity: 0.5,
    },
    submitText: {
      color: colors.accentText,
      fontSize: 15,
    },
    invite: {
      marginTop: 'auto',
      paddingTop: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    inviteText: {
      color: colors.textMuted,
      fontSize: 11,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
