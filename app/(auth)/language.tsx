import { type Href, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BrandLogo } from '@/components/BrandLogo';
import { useLanguage, type LanguageCode } from '@/lib/i18n';
import { reloadForRtl } from '@/lib/rtl';
import { useTheme, type ThemeColors } from '@/lib/theme';
import { Ionicons } from '@expo/vector-icons';

export default function LanguageScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { setLanguage } = useLanguage();
  const router = useRouter();
  const [selected, setSelected] = useState<LanguageCode>('en');
  const styles = makeStyles(colors);

  async function continueWithSelection() {
    const needsReload = await setLanguage(selected);
    if (needsReload) {
      Alert.alert(t('rtl.restartTitle'), t('rtl.restartBody'), [
        {
          text: t('rtl.restartAction'),
          onPress: () => {
            void reloadForRtl();
          },
        },
      ]);
      return;
    }
    router.replace('/(auth)/sign-in' as Href);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <BrandLogo />
        </View>
        <AppText weight="600" style={styles.heading}>
          {t('language.title')}
        </AppText>

        <LanguageOption
          code="en"
          label={t('language.english')}
          subtitle={t('language.englishSubtitle')}
          selected={selected === 'en'}
          onPress={() => setSelected('en')}
          colors={colors}
        />
        <LanguageOption
          code="ur"
          label={t('language.urdu')}
          subtitle={t('language.urduSubtitle')}
          selected={selected === 'ur'}
          onPress={() => setSelected('ur')}
          colors={colors}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => void continueWithSelection()}
          style={({ pressed }) => [
            styles.continueButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <AppText weight="600" style={styles.continueText}>
            {t('language.continue')}
          </AppText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

type OptionProps = {
  code: LanguageCode;
  label: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  colors: ThemeColors;
};

function LanguageOption({
  code,
  label,
  subtitle,
  selected,
  onPress,
  colors,
}: OptionProps) {
  const styles = makeStyles(colors);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.option, selected ? styles.optionSelected : null]}
    >
      <View style={styles.optionCopy}>
        <AppText
          weight="600"
          style={code === 'ur' ? styles.urduLabel : styles.optionLabel}
        >
          {label}
        </AppText>
        <AppText style={styles.optionSubtitle}>{subtitle}</AppText>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        color={selected ? colors.accent : colors.textMuted}
        size={23}
      />
    </Pressable>
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
      paddingTop: 44,
      paddingBottom: 30,
      paddingStart: 26,
      paddingEnd: 26,
    },
    logo: {
      marginBottom: 28,
    },
    heading: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '600',
      marginBottom: 26,
    },
    option: {
      width: '100%',
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      paddingVertical: 18,
      paddingStart: 20,
      paddingEnd: 20,
      marginBottom: 14,
    },
    optionSelected: {
      borderColor: colors.accent,
      borderWidth: 2,
    },
    optionCopy: {
      flex: 1,
    },
    optionLabel: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    urduLabel: {
      color: colors.textPrimary,
      fontFamily: 'NotoNastaliqUrdu_400Regular',
      fontSize: 16,
      lineHeight: 25,
    },
    optionSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    continueButton: {
      width: '100%',
      marginTop: 'auto',
      borderRadius: 12,
      padding: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    continueText: {
      color: colors.accentText,
      fontSize: 15,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.75,
    },
  });
}
