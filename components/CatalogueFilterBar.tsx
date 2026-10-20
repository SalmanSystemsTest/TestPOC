import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { sortByBuyerPreference } from '@/lib/catalogue-preference-sort';
import {
  emptyCatalogueFilters,
  hasCatalogueFilter,
  useCatalogueFilterOptions,
  type CatalogueFilters,
} from '@/lib/queries/catalogue-filters';
import { useTheme, type ThemeColors } from '@/lib/theme';

type FilterKey = keyof CatalogueFilters;

type Props = {
  value: CatalogueFilters;
  onChange: (next: CatalogueFilters) => void;
  preferredMakes?: string[];
  preferredGroups?: string[];
};

const FILTER_KEYS: FilterKey[] = [
  'makeName',
  'groupName',
  'subGroupName',
  'brand',
  'catModel',
  'itemModel',
];

export function CatalogueFilterBar({
  value,
  onChange,
  preferredMakes = [],
  preferredGroups = [],
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const options = useCatalogueFilterOptions();
  const [openKey, setOpenKey] = useState<FilterKey | null>(null);

  const lists = useMemo(
    () => ({
      makeName: sortByBuyerPreference(
        options.data?.makes ?? [],
        preferredMakes
      ),
      groupName: sortByBuyerPreference(
        options.data?.groups ?? [],
        preferredGroups
      ),
      subGroupName: [...(options.data?.subGroups ?? [])].sort((a, b) =>
        a.localeCompare(b)
      ),
      brand: [...(options.data?.brands ?? [])].sort((a, b) => a.localeCompare(b)),
      catModel: [...(options.data?.catModels ?? [])].sort((a, b) =>
        a.localeCompare(b)
      ),
      itemModel: [...(options.data?.itemModels ?? [])].sort((a, b) =>
        a.localeCompare(b)
      ),
    }),
    [options.data, preferredGroups, preferredMakes]
  );

  const labelKey: Record<FilterKey, string> = {
    makeName: 'catalogue.filterMake',
    groupName: 'catalogue.filterGroup',
    subGroupName: 'catalogue.filterSubGroup',
    brand: 'catalogue.filterBrand',
    catModel: 'catalogue.filterCatModel',
    itemModel: 'catalogue.filterItemModel',
  };

  const openList = openKey ? lists[openKey] : [];
  const selected = openKey ? value[openKey] : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <AppText variant="caption" weight="600" style={styles.title}>
          {t('catalogue.filtersTitle')}
        </AppText>
        {hasCatalogueFilter(value) ? (
          <Pressable
            onPress={() => onChange(emptyCatalogueFilters)}
            accessibilityRole="button"
            hitSlop={8}
          >
            <AppText variant="caption" weight="600" style={styles.clear}>
              {t('common.clear')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <View style={styles.row}>
        {FILTER_KEYS.map((key) => {
          const current = value[key];
          return (
            <Pressable
              key={key}
              style={[styles.chip, current ? styles.chipActive : null]}
              onPress={() => setOpenKey(key)}
              accessibilityRole="button"
            >
              <AppText
                variant="caption"
                numberOfLines={1}
                style={current ? styles.chipTextActive : styles.chipText}
              >
                {current ?? t(labelKey[key])}
              </AppText>
              <Ionicons
                name="chevron-down"
                size={14}
                color={current ? colors.accentText : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={openKey !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenKey(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpenKey(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHeader}>
              <AppText weight="700">
                {openKey ? t(labelKey[openKey]) : ''}
              </AppText>
              <Pressable onPress={() => setOpenKey(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>
            <FlatList
              data={['', ...openList]}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item }) => {
                const isAll = item === '';
                const isSelected = isAll ? !selected : selected === item;
                return (
                  <Pressable
                    style={styles.option}
                    onPress={() => {
                      if (!openKey) return;
                      onChange({
                        ...value,
                        [openKey]: isAll ? null : item,
                      });
                      setOpenKey(null);
                    }}
                  >
                    <AppText
                      weight={isSelected ? '700' : '400'}
                      style={isSelected ? styles.optionSelected : undefined}
                    >
                      {isAll ? t('catalogue.filterAny') : item}
                    </AppText>
                    {isSelected ? (
                      <Ionicons name="checkmark" size={18} color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: 8 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: { color: colors.textSecondary },
    clear: { color: colors.accent },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      maxWidth: '48%',
      paddingStart: 10,
      paddingEnd: 8,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: { color: colors.textSecondary, flexShrink: 1 },
    chipTextActive: { color: colors.accentText, flexShrink: 1 },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    sheet: {
      maxHeight: '70%',
      borderTopStartRadius: 16,
      borderTopEndRadius: 16,
      backgroundColor: colors.surface,
      paddingBottom: 24,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingStart: 16,
      paddingEnd: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    optionSelected: { color: colors.primary },
  });
}
