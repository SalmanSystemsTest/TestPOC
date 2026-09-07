// Quantity stepper for request basket lines.

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function QtyStepper({ value, disabled, onChange }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || value <= 1}
        onPress={() => onChange(Math.max(1, value - 1))}
        style={styles.button}
      >
        <Ionicons name="remove" size={16} color={colors.textSecondary} />
      </Pressable>
      <AppText variant="caption" weight="600" style={styles.value}>
        {value}
      </AppText>
      <Pressable
        accessibilityRole="button"
        disabled={disabled || value >= 9999}
        onPress={() => onChange(Math.min(9999, value + 1))}
        style={styles.button}
      >
        <Ionicons name="add" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
    },
    button: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    value: {
      minWidth: 28,
      color: colors.textPrimary,
      textAlign: 'center',
    },
  });
}
