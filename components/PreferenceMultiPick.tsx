import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
};

export function PreferenceMultiPick({ options, selected, onChange }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const selectedSet = new Set(selected);

  const toggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((entry) => entry !== value));
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const active = selectedSet.has(option);
        return (
          <Pressable
            key={option}
            onPress={() => toggle(option)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            style={[styles.chip, active ? styles.chipActive : null]}
          >
            <AppText
              variant="caption"
              weight={active ? '700' : '500'}
              style={active ? styles.chipTextActive : styles.chipText}
              numberOfLines={2}
            >
              {option}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      maxWidth: '48%',
      paddingStart: 12,
      paddingEnd: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceAlt,
    },
    chipText: {
      color: colors.textSecondary,
    },
    chipTextActive: {
      color: colors.textPrimary,
    },
  });
}
