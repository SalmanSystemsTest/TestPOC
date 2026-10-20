import { Ionicons } from '@expo/vector-icons';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { sortByBuyerPreference } from '@/lib/catalogue-preference-sort';
import {
  useHierarchyStepOptions,
  type HierarchySelection,
  type HierarchyStep,
} from '@/lib/queries/catalogue-hierarchy';
import { useTheme, type ThemeColors } from '@/lib/theme';

export type { HierarchyStep };

type LevelKey = 'makes' | 'groups' | 'subGroups' | 'brands';

type Props = {
  value: HierarchySelection;
  onChange: (next: HierarchySelection) => void;
  step: HierarchyStep;
  onStepChange: (step: HierarchyStep) => void;
  onComplete: () => void;
  preferredMakes?: string[];
  preferredGroups?: string[];
};

const STEPS: HierarchyStep[] = ['make', 'group', 'subGroup', 'brand'];

const STEP_TO_KEY: Record<HierarchyStep, LevelKey> = {
  make: 'makes',
  group: 'groups',
  subGroup: 'subGroups',
  brand: 'brands',
};

function committedAfterStep(
  step: HierarchyStep,
  value: HierarchySelection,
  draft: string[]
): HierarchySelection {
  if (step === 'make') {
    return { makes: draft, groups: [], subGroups: [], brands: [] };
  }
  if (step === 'group') {
    return { ...value, groups: draft, subGroups: [], brands: [] };
  }
  if (step === 'subGroup') {
    return { ...value, subGroups: draft, brands: [] };
  }
  return { ...value, brands: draft };
}

export function CatalogueHierarchyPicker({
  value,
  onChange,
  step,
  onStepChange,
  onComplete,
  preferredMakes = [],
  preferredGroups = [],
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const levelKey = STEP_TO_KEY[step];
  const [draft, setDraft] = useState<string[]>(() => value[levelKey]);
  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    setDraft(value[levelKey]);
  }, [step, levelKey, value]);

  const options = useHierarchyStepOptions(step, value);
  const list = useMemo(() => {
    const raw = options.data ?? [];
    if (step === 'make') {
      return sortByBuyerPreference(raw, preferredMakes);
    }
    if (step === 'group') {
      return sortByBuyerPreference(raw, preferredGroups);
    }
    return [...raw].sort((a, b) => a.localeCompare(b));
  }, [options.data, preferredGroups, preferredMakes, step]);

  const labelKey: Record<HierarchyStep, string> = {
    make: 'catalogue.filterMake',
    group: 'catalogue.filterGroup',
    subGroup: 'catalogue.filterSubGroup',
    brand: 'catalogue.filterBrand',
  };

  const allSelected = useMemo(
    () => list.length > 0 && list.every((item) => draft.includes(item)),
    [list, draft]
  );

  const toggleDraft = (item: string) => {
    setDraft((current) =>
      current.includes(item)
        ? current.filter((entry) => entry !== item)
        : [...current, item]
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setDraft([]);
      return;
    }
    setDraft([...list]);
  };

  const goBack = () => {
    if (stepIndex <= 0) return;
    onStepChange(STEPS[stepIndex - 1]);
  };

  const goNext = () => {
    if (draft.length === 0) return;
    const next = committedAfterStep(step, value, draft);
    onChange(next);
    if (step === 'brand') {
      onComplete();
      return;
    }
    onStepChange(STEPS[stepIndex + 1]);
  };

  const jumpToStep = (target: HierarchyStep) => {
    const targetIndex = STEPS.indexOf(target);
    if (targetIndex > stepIndex) return;
    if (target === 'group' && value.makes.length === 0) return;
    if (target === 'subGroup' && value.groups.length === 0) return;
    if (target === 'brand' && value.subGroups.length === 0) return;
    onStepChange(target);
  };

  const showLoader = options.isPending && list.length === 0;

  const renderOptionRow = (item: string, isSelected: boolean, onPress: () => void) => (
    <Pressable
      style={[styles.option, isSelected ? styles.optionSelected : null]}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
    >
      <AppText weight={isSelected ? '700' : '500'} style={styles.optionLabel}>
        {item}
      </AppText>
      <Ionicons
        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={isSelected ? colors.accent : colors.textMuted}
      />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.progressCard}>
        <View style={styles.stepperRow}>
          {STEPS.map((entry, index) => {
            const done = index < stepIndex;
            const active = entry === step;
            const reachable =
              entry === 'make' ||
              (entry === 'group' && value.makes.length > 0) ||
              (entry === 'subGroup' && value.groups.length > 0) ||
              (entry === 'brand' && value.subGroups.length > 0);
            const canTap = reachable || done || active;

            return (
              <Fragment key={entry}>
                {index > 0 ? (
                  <View style={styles.connectorTrack}>
                    <View
                      style={[
                        styles.connector,
                        index <= stepIndex ? styles.connectorDone : null,
                      ]}
                    />
                  </View>
                ) : null}
                <View style={styles.stepColumn}>
                  <Pressable
                    disabled={!canTap}
                    onPress={() => jumpToStep(entry)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t(labelKey[entry])}
                  >
                    <View
                      style={[
                        styles.stepNode,
                        active ? styles.stepNodeActive : null,
                        done ? styles.stepNodeDone : null,
                        !canTap ? styles.stepNodeLocked : null,
                      ]}
                    >
                      {done ? (
                        <Ionicons
                          name="checkmark"
                          size={14}
                          color={colors.accentText}
                        />
                      ) : (
                        <AppText
                          variant="caption"
                          weight="700"
                          style={
                            active
                              ? styles.stepNodeNumberActive
                              : styles.stepNodeNumber
                          }
                        >
                          {String(index + 1)}
                        </AppText>
                      )}
                    </View>
                  </Pressable>
                  <AppText
                    variant="caption"
                    weight={active ? '700' : '500'}
                    numberOfLines={2}
                    style={[
                      styles.stepCaption,
                      active ? styles.stepCaptionActive : null,
                      !canTap && !done && !active ? styles.stepCaptionMuted : null,
                    ]}
                  >
                    {t(labelKey[entry])}
                  </AppText>
                </View>
              </Fragment>
            );
          })}
        </View>
        <AppText variant="caption" style={styles.hint}>
          {t('catalogue.hierarchyMultiHint')}
        </AppText>
      </View>

      {draft.length > 0 && !allSelected ? (
        <View style={styles.chips}>
          {draft.map((item) => (
            <Pressable
              key={item}
              style={styles.chip}
              onPress={() => toggleDraft(item)}
              accessibilityRole="button"
            >
              <AppText variant="caption" weight="600" style={styles.chipText}>
                {item}
              </AppText>
              <Ionicons name="close" size={14} color={colors.accentText} />
            </Pressable>
          ))}
        </View>
      ) : allSelected ? (
        <View style={styles.allBadge}>
          <AppText variant="caption" weight="600" style={styles.allBadgeText}>
            {t('catalogue.hierarchySelectAll')}
          </AppText>
        </View>
      ) : null}

      {showLoader ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.loader}>
          <AppText style={styles.empty}>{t('catalogue.noResults')}</AppText>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          extraData={draft}
          ListHeaderComponent={
            renderOptionRow(
              t('catalogue.hierarchySelectAll'),
              allSelected,
              toggleAll
            )
          }
          renderItem={({ item }) =>
            renderOptionRow(item, draft.includes(item), () => toggleDraft(item))
          }
        />
      )}

      <View style={styles.footer}>
        {stepIndex > 0 ? (
          <Pressable
            style={styles.secondaryBtn}
            onPress={goBack}
            accessibilityRole="button"
          >
            <AppText weight="600">{t('catalogue.hierarchyBack')}</AppText>
          </Pressable>
        ) : (
          <View style={styles.footerSpacer} />
        )}
        <Pressable
          style={[
            styles.primaryBtn,
            draft.length === 0 ? styles.primaryBtnDisabled : null,
          ]}
          disabled={draft.length === 0}
          onPress={goNext}
          accessibilityRole="button"
        >
          <AppText weight="700" style={styles.primaryBtnText}>
            {step === 'brand'
              ? t('catalogue.hierarchyShowParts')
              : t('catalogue.hierarchyContinue')}
          </AppText>
          <Ionicons name="arrow-forward" size={18} color={colors.accentText} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      flex: 1,
      gap: 12,
    },
    progressCard: {
      gap: 8,
      padding: 14,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    stepColumn: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    connectorTrack: {
      flex: 1,
      paddingTop: 13,
      minWidth: 8,
    },
    connector: {
      height: 2,
      backgroundColor: colors.border,
    },
    connectorDone: {
      backgroundColor: colors.accent,
    },
    stepCaption: {
      color: colors.textSecondary,
      textAlign: 'center',
    },
    stepCaptionActive: {
      color: colors.textPrimary,
    },
    stepCaptionMuted: {
      color: colors.textMuted,
    },
    stepNode: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    stepNodeActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    stepNodeDone: {
      borderColor: colors.accent,
      backgroundColor: colors.accent,
    },
    stepNodeLocked: {
      opacity: 0.45,
    },
    stepNodeNumber: {
      color: colors.textMuted,
    },
    stepNodeNumberActive: {
      color: colors.accentText,
    },
    hint: {
      color: colors.textSecondary,
    },
    allBadge: {
      alignSelf: 'flex-start',
      paddingStart: 12,
      paddingEnd: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    allBadgeText: {
      color: colors.accentText,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingStart: 10,
      paddingEnd: 8,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    chipText: {
      color: colors.accentText,
      maxWidth: 160,
    },
    list: {
      flex: 1,
    },
    listContent: {
      gap: 8,
      paddingBottom: 8,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingStart: 16,
      paddingEnd: 16,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surfaceAlt,
    },
    optionLabel: {
      flex: 1,
    },
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      color: colors.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 4,
    },
    footerSpacer: {
      flex: 1,
    },
    secondaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    primaryBtn: {
      flex: 2,
      minHeight: 48,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.accent,
    },
    primaryBtnDisabled: {
      opacity: 0.45,
    },
    primaryBtnText: {
      color: colors.accentText,
    },
  });
}
