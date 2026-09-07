// Horizontal category filter chips, "All" first.

import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { localisedName } from '@/lib/format';
import type { Category } from '@/lib/queries/vehicles';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
};

export function CategoryChips({ categories, selectedId, onSelect }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const chips: { id: number | null; label: string }[] = [
    { id: null, label: t('common.all') },
    ...categories.map((row) => ({
      id: row.id,
      label: localisedName(row, i18n.language),
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map((chip) => {
        const active = chip.id === selectedId;
        return (
          <Pressable
            key={String(chip.id)}
            onPress={() => onSelect(chip.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active ? styles.chipActive : null]}
          >
            <AppText
              variant="caption"
              weight={active ? '600' : '400'}
              style={active ? styles.chipTextActive : styles.chipText}
            >
              {chip.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      gap: 8,
      paddingEnd: 4,
    },
    chip: {
      paddingStart: 14,
      paddingEnd: 14,
      paddingTop: 8,
      paddingBottom: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.accentText,
    },
  });
}
