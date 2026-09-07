// Reusable single-select bottom sheet used by the vehicle pickers.

import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { useTheme, type ThemeColors } from '@/lib/theme';

export type SheetOption = {
  /** null is the "no constraint" row, e.g. "All models". */
  id: number | null;
  label: string;
};

type Props = {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
};

export function FilterSheet({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = makeStyles(colors);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <AppText variant="title" weight="600" style={styles.title}>
            {title}
          </AppText>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <FlatList
          data={options}
          keyExtractor={(item) => String(item.id)}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            return (
              <Pressable
                style={styles.row}
                accessibilityRole="button"
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <AppText style={selected ? styles.rowTextActive : styles.rowText}>
                  {item.label}
                </AppText>
                {selected ? (
                  <Ionicons name="checkmark" size={20} color={colors.accent} />
                ) : null}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      maxHeight: '60%',
      backgroundColor: colors.surface,
      borderTopStartRadius: 20,
      borderTopEndRadius: 20,
      paddingTop: 16,
      paddingBottom: 28,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingStart: 20,
      paddingEnd: 20,
      paddingBottom: 12,
    },
    title: {
      fontSize: 18,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginStart: 20,
      marginEnd: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingStart: 20,
      paddingEnd: 20,
      paddingTop: 14,
      paddingBottom: 14,
    },
    rowText: {
      color: colors.textPrimary,
    },
    rowTextActive: {
      color: colors.accent,
    },
  });
}
