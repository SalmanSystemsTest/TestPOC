import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Variant = 'title' | 'body' | 'caption';

type Props = TextProps & {
  variant?: Variant;
  weight?: '400' | '500' | '600' | '700';
};

export function AppText({
  variant = 'body',
  weight,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const urdu = i18n.language === 'ur';
  const styles = makeStyles(colors, urdu);
  const resolvedWeight = weight ?? (variant === 'title' ? '600' : '400');

  const variantStyle =
    variant === 'title' ? styles.title : variant === 'caption' ? styles.caption : styles.body;
  const weightStyle =
    resolvedWeight === '700'
      ? styles.bold
      : resolvedWeight === '600'
        ? styles.semibold
        : resolvedWeight === '500'
          ? styles.medium
          : styles.regular;

  return (
    <Text
      {...rest}
      style={[
        styles.base,
        variantStyle,
        urdu ? styles.urdu : weightStyle,
        urdu && variant === 'title' ? styles.urduTitle : null,
        style,
      ]}
    />
  );
}

function makeStyles(colors: ThemeColors, urdu: boolean) {
  return StyleSheet.create({
    base: {
      color: colors.textPrimary,
      writingDirection: urdu ? 'rtl' : 'ltr',
    },
    title: {
      fontSize: 24,
    },
    body: {
      fontSize: 16,
    },
    caption: {
      fontSize: 13,
    },
    urdu: {
      fontFamily: 'NotoNastaliqUrdu_400Regular',
      fontWeight: '400',
      lineHeight: 36,
    },
    regular: {
      fontFamily: 'Inter_400Regular',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'Inter_500Medium',
      fontWeight: '500',
    },
    semibold: {
      fontFamily: 'Inter_600SemiBold',
      fontWeight: '600',
    },
    bold: {
      fontFamily: 'Inter_700Bold',
      fontWeight: '700',
    },
    urduTitle: {
      lineHeight: 48,
    },
  });
}
