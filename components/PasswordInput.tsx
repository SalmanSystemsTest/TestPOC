import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  showPasswordLabel: string;
  hidePasswordLabel: string;
  editable?: boolean;
  testID?: string;
};

export function PasswordInput({
  value,
  onChangeText,
  placeholder,
  showPasswordLabel,
  hidePasswordLabel,
  editable = true,
  testID,
}: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={!visible}
        style={styles.field}
        value={value}
        testID={testID}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? hidePasswordLabel : showPasswordLabel}
        disabled={!editable}
        hitSlop={8}
        onPress={() => setVisible((v) => !v)}
        style={styles.toggle}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginBottom: 16,
      position: 'relative',
    },
    field: {
      width: '100%',
      minHeight: 48,
      paddingVertical: 13,
      paddingStart: 14,
      paddingEnd: 44,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
    },
    toggle: {
      position: 'absolute',
      end: 10,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      minWidth: 32,
      alignItems: 'center',
    },
  });
}
