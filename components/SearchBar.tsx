// Catalogue search input. Debouncing is the caller's concern so the
// screen controls how often the RPC fires.

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  value: string;
  onChangeText: (next: string) => void;
};

export function SearchBar({ value, onChangeText }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('catalogue.searchPlaceholder')}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={[styles.input, i18n.language === 'ur' ? styles.inputUrdu : null]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel={t('common.clear')}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingStart: 14,
      paddingEnd: 14,
      height: 46,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
    },
    inputUrdu: {
      fontFamily: 'NotoNastaliqUrdu_400Regular',
      lineHeight: 30,
    },
  });
}
