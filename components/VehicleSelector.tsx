// Three dependent vehicle pickers. Choosing a make resets model and
// variant, because a Corolla is not a Honda model.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { FilterSheet, type SheetOption } from '@/components/FilterSheet';
import { localisedName } from '@/lib/format';
import { useMakes, useModels, useVariants } from '@/lib/queries/vehicles';
import { useTheme, type ThemeColors } from '@/lib/theme';

export type VehicleSelection = {
  makeId: number | null;
  modelId: number | null;
  variantId: number | null;
};

type Props = {
  value: VehicleSelection;
  onChange: (next: VehicleSelection) => void;
};

type OpenSheet = 'make' | 'model' | 'variant' | null;

export function VehicleSelector({ value, onChange }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [open, setOpen] = useState<OpenSheet>(null);

  const makes = useMakes();
  const models = useModels(value.makeId);
  const variants = useVariants(value.modelId);

  const makeRows = makes.data ?? [];
  const modelRows = models.data ?? [];
  const variantRows = variants.data ?? [];

  const selectedMake = makeRows.find((m) => m.id === value.makeId) ?? null;
  const selectedModel = modelRows.find((m) => m.id === value.modelId) ?? null;
  const selectedVariant =
    variantRows.find((v) => v.id === value.variantId) ?? null;

  const name = (row: { name: string; name_ur: string | null }) =>
    localisedName(row, i18n.language);

  const makeOptions: SheetOption[] = makeRows.map((row) => ({
    id: row.id,
    label: name(row),
  }));

  const modelOptions: SheetOption[] = [
    { id: null, label: t('catalogue.allModels') },
    ...modelRows.map((row) => ({ id: row.id, label: name(row) })),
  ];

  const variantOptions: SheetOption[] = [
    { id: null, label: t('catalogue.allVariants') },
    ...variantRows.map((row) => ({ id: row.id, label: name(row) })),
  ];

  const hasSelection = value.makeId !== null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText variant="caption" weight="600" style={styles.label}>
          {t('catalogue.vehicleTitle')}
        </AppText>
        {hasSelection ? (
          <Pressable
            onPress={() =>
              onChange({ makeId: null, modelId: null, variantId: null })
            }
            accessibilityRole="button"
            hitSlop={8}
          >
            <AppText variant="caption" weight="600" style={styles.clear}>
              {t('common.clear')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <PickerButton
          text={selectedMake ? name(selectedMake) : t('catalogue.make')}
          active={value.makeId !== null}
          onPress={() => setOpen('make')}
          colors={colors}
        />
        <PickerButton
          text={selectedModel ? name(selectedModel) : t('catalogue.model')}
          active={value.modelId !== null}
          disabled={value.makeId === null}
          onPress={() => setOpen('model')}
          colors={colors}
        />
        <PickerButton
          text={selectedVariant ? name(selectedVariant) : t('catalogue.variant')}
          active={value.variantId !== null}
          disabled={value.modelId === null}
          onPress={() => setOpen('variant')}
          colors={colors}
        />
      </ScrollView>

      <FilterSheet
        visible={open === 'make'}
        title={t('catalogue.selectMake')}
        options={makeOptions}
        selectedId={value.makeId}
        onSelect={(id) =>
          onChange({ makeId: id, modelId: null, variantId: null })
        }
        onClose={() => setOpen(null)}
      />
      <FilterSheet
        visible={open === 'model'}
        title={t('catalogue.selectModel')}
        options={modelOptions}
        selectedId={value.modelId}
        onSelect={(id) =>
          onChange({ makeId: value.makeId, modelId: id, variantId: null })
        }
        onClose={() => setOpen(null)}
      />
      <FilterSheet
        visible={open === 'variant'}
        title={t('catalogue.selectVariant')}
        options={variantOptions}
        selectedId={value.variantId}
        onSelect={(id) =>
          onChange({
            makeId: value.makeId,
            modelId: value.modelId,
            variantId: id,
          })
        }
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

function PickerButton({
  text,
  active,
  disabled,
  onPress,
  colors,
}: {
  text: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={[
        styles.picker,
        active ? styles.pickerActive : null,
        disabled ? styles.pickerDisabled : null,
      ]}
    >
      <AppText
        variant="caption"
        weight={active ? '600' : '400'}
        style={active ? styles.pickerTextActive : styles.pickerText}
      >
        {text}
      </AppText>
      <Ionicons
        name="chevron-down"
        size={14}
        color={active ? colors.accent : colors.textMuted}
      />
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      gap: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    label: {
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    clear: {
      color: colors.accent,
    },
    row: {
      gap: 8,
      paddingEnd: 4,
    },
    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingStart: 14,
      paddingEnd: 12,
      paddingTop: 9,
      paddingBottom: 9,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    pickerActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentBackground,
    },
    pickerDisabled: {
      opacity: 0.45,
    },
    pickerText: {
      color: colors.textSecondary,
    },
    pickerTextActive: {
      color: colors.accent,
    },
  });
}
