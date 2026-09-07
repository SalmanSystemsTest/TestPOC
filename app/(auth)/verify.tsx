import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BrandLogo } from '@/components/BrandLogo';
import { completeSignIn, startSignIn } from '@/lib/auth';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function VerifyScreen() {
  const params = useLocalSearchParams<{ identifier?: string }>();
  const identifier = params.identifier ?? '';
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function verify() {
    if (code.length !== 6 || submitting) return;
    setSubmitting(true);
    setErrorKey(null);
    const result = await completeSignIn({ identifier, code });
    setSubmitting(false);
    if (result.status === 'signed_in') {
      router.replace('/(tabs)' as Href);
    } else if (result.status === 'not_registered') {
      setErrorKey('auth.notRegistered');
    } else if (result.status === 'bad_credentials') {
      setErrorKey('auth.badCredentials');
    } else {
      setErrorKey('auth.genericError');
    }
  }

  async function resend() {
    if (seconds > 0 || submitting) return;
    setSubmitting(true);
    const result = await startSignIn({ identifier });
    setSubmitting(false);
    if (result.status === 'code_sent') {
      setSeconds(30);
      setErrorKey(null);
    } else {
      setErrorKey(
        result.status === 'not_registered'
          ? 'auth.notRegistered'
          : 'auth.genericError'
      );
    }
  }

  const canVerify = code.length === 6 && !submitting;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <BrandLogo />
        </View>
        <AppText weight="600" style={styles.heading}>
          {t('auth.verifyTitle')}
        </AppText>
        <AppText style={styles.subtitle}>{t('auth.verifySubtitle')}</AppText>

        <AppText variant="caption" style={styles.label}>
          {t('auth.code')}
        </AppText>
        <TextInput
          autoFocus
          editable={!submitting}
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
          selectionColor={colors.primary}
          style={styles.code}
          value={code}
        />

        {errorKey ? <AppText style={styles.error}>{t(errorKey)}</AppText> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canVerify}
          onPress={() => void verify()}
          style={[styles.submit, !canVerify ? styles.submitDisabled : null]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <AppText weight="600" style={styles.submitText}>
              {t('auth.verify')}
            </AppText>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={seconds > 0 || submitting}
          onPress={() => void resend()}
          style={styles.resend}
        >
          <AppText
            weight="600"
            style={seconds > 0 ? styles.resendDisabled : styles.resendText}
          >
            {seconds > 0 ? t('auth.resendIn', { seconds }) : t('auth.resend')}
          </AppText>
        </Pressable>
      </View>
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
      lineHeight: 34,
      marginBottom: 4,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 22,
      marginBottom: 28,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 7,
    },
    code: {
      width: '100%',
      minHeight: 56,
      paddingVertical: 13,
      paddingStart: 14,
      paddingEnd: 14,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 24,
      letterSpacing: 12,
      textAlign: 'center',
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
    },
    submitDisabled: {
      opacity: 0.5,
    },
    submitText: {
      color: colors.accentText,
      fontSize: 15,
    },
    resend: {
      alignSelf: 'center',
      padding: 14,
      marginTop: 8,
    },
    resendText: {
      color: colors.accent,
      fontSize: 12,
    },
    resendDisabled: {
      color: colors.textMuted,
      fontSize: 12,
    },
  });
}
