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
import { PasswordInput } from '@/components/PasswordInput';
import { signInShape } from '@/lib/auth';
import { isDevAuth } from '@/lib/config';
import {
  checkSignupEligibility,
  completeRegistration,
} from '@/lib/queries/signup';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Step = 'username' | 'credentials';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  function backToSignIn(error: 'signupNotAuthorized' | 'signupAlreadyRegistered') {
    router.replace({
      pathname: '/(auth)/sign-in',
      params: { signupError: error },
    } as Href);
  }

  async function validateUsername() {
    if (!username.trim() || submitting) return;
    setSubmitting(true);
    setErrorKey(null);
    try {
      const status = await checkSignupEligibility(username);
      if (status === 'not_on_list') {
        backToSignIn('signupNotAuthorized');
        return;
      }
      if (status === 'already_registered') {
        backToSignIn('signupAlreadyRegistered');
        return;
      }
      if (isDevAuth) {
        setStep('credentials');
        return;
      }
      const result = await completeRegistration({ identifier: username });
      if (result.status === 'code_sent') {
        router.replace({
          pathname: '/(auth)/verify',
          params: { identifier: username },
        } as Href);
        return;
      }
      if (result.status === 'not_registered') {
        backToSignIn('signupNotAuthorized');
        return;
      }
      setErrorKey('auth.genericError');
    } catch {
      setErrorKey('auth.genericError');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRegistration() {
    if (password.length < 8) {
      setErrorKey('auth.passwordTooShort');
      return;
    }
    if (password !== confirmPassword) {
      setErrorKey('auth.passwordMismatch');
      return;
    }
    setSubmitting(true);
    setErrorKey(null);
    try {
      const result = await completeRegistration({
        identifier: username,
        password,
      });
      if (result.status === 'signed_in') {
        router.replace('/(auth)/complete-profile' as Href);
        return;
      }
      if (result.status === 'already_registered') {
        backToSignIn('signupAlreadyRegistered');
        return;
      }
      if (result.status === 'not_registered') {
        backToSignIn('signupNotAuthorized');
        return;
      }
      if (result.status === 'confirmation_required') {
        setErrorKey('auth.signUpEmailConfirmationRequired');
        return;
      }
      setErrorKey('auth.signUpGenericError');
    } catch {
      setErrorKey('auth.signUpGenericError');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmitUsername = username.trim().length > 0 && !submitting;
  const canSubmitCredentials =
    password.length > 0 && confirmPassword.length > 0 && !submitting;

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
          {t('auth.signUpTitle')}
        </AppText>
        <AppText style={styles.subtitle}>
          {step === 'username' ? t('auth.signUpSubtitle') : t('auth.signUpPasswordSubtitle')}
        </AppText>

        {step === 'username' ? (
          <>
            <AppText variant="caption" style={styles.label}>
              {t('auth.ssgUsername')}
            </AppText>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              keyboardType={
                signInShape.identifierType === 'email' ? 'email-address' : 'phone-pad'
              }
              onChangeText={setUsername}
              placeholder={t(
                signInShape.identifierType === 'email'
                  ? 'auth.emailPlaceholder'
                  : 'auth.phonePlaceholder'
              )}
              placeholderTextColor={colors.textMuted}
              style={styles.field}
              value={username}
            />
          </>
        ) : (
          <>
            <AppText variant="caption" style={styles.label}>
              {t('auth.password')}
            </AppText>
            <PasswordInput
              editable={!submitting}
              hidePasswordLabel={t('auth.hidePassword')}
              onChangeText={setPassword}
              placeholder={t('auth.passwordPlaceholder')}
              showPasswordLabel={t('auth.showPassword')}
              value={password}
            />
            <AppText variant="caption" style={styles.label}>
              {t('auth.confirmPassword')}
            </AppText>
            <PasswordInput
              editable={!submitting}
              hidePasswordLabel={t('auth.hidePassword')}
              onChangeText={setConfirmPassword}
              placeholder={t('auth.passwordPlaceholder')}
              showPasswordLabel={t('auth.showPassword')}
              value={confirmPassword}
            />
          </>
        )}

        {errorKey ? <AppText style={styles.error}>{t(errorKey)}</AppText> : null}

        <Pressable
          accessibilityRole="button"
          disabled={step === 'username' ? !canSubmitUsername : !canSubmitCredentials}
          onPress={() => void (step === 'username' ? validateUsername() : submitRegistration())}
          style={({ pressed }) => [
            styles.submit,
            (step === 'username' ? !canSubmitUsername : !canSubmitCredentials)
              ? styles.submitDisabled
              : null,
            pressed ? styles.pressed : null,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <AppText weight="600" style={styles.submitText}>
              {step === 'username' ? t('auth.signUpContinue') : t('auth.signUpCreate')}
            </AppText>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={() => router.replace('/(auth)/sign-in' as Href)}
          style={styles.backLink}
        >
          <AppText weight="600" style={styles.backLinkText}>
            {t('auth.signInInstead')}
          </AppText>
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
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      flex: 1,
      paddingTop: 38,
      paddingBottom: 28,
      paddingStart: 26,
      paddingEnd: 26,
    },
    logo: { marginBottom: 24 },
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
    submitDisabled: { opacity: 0.5 },
    submitText: { color: colors.accentText, fontSize: 15 },
    backLink: { marginTop: 16, alignItems: 'center' },
    backLinkText: { color: colors.primary, fontSize: 14 },
    invite: {
      marginTop: 'auto',
      paddingTop: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    inviteText: { color: colors.textMuted, fontSize: 11 },
    pressed: { opacity: 0.75 },
  });
}
