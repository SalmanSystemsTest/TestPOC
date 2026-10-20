import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { BrandLogo } from '@/components/BrandLogo';
import { CatalogueFilterBar } from '@/components/CatalogueFilterBar';
import {
  CatalogueHierarchyPicker,
  type HierarchyStep,
} from '@/components/CatalogueHierarchyPicker';
import { PartCard } from '@/components/PartCard';
import { PartListRow } from '@/components/PartListRow';
import { SearchBar } from '@/components/SearchBar';
import { useAuthSession } from '@/lib/auth-context';
import { config, hasWhatsapp } from '@/lib/config';
import {
  emptyHierarchySelection,
  hierarchyHasSelection,
  useHierarchyPartsSearch,
} from '@/lib/queries/catalogue-hierarchy';
import { useAddToCart, useCart } from '@/lib/queries/cart';
import { useFavouriteIds, useToggleFavourite } from '@/lib/queries/favourites';
import {
  emptyCatalogueFilters,
  type CatalogueFilters,
} from '@/lib/queries/catalogue-filters';
import { usePartsSearch, type Part } from '@/lib/queries/parts';
import { useProfile } from '@/lib/queries/profile';
import { useTheme, type ThemeColors } from '@/lib/theme';

const SEARCH_DEBOUNCE_MS = 300;

type CatalogueViewMode = 'grid' | 'hierarchy';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = makeStyles(colors);

  const { session } = useAuthSession();
  const userId = session?.user.id;
  const profile = useProfile(userId);

  const [viewMode, setViewMode] = useState<CatalogueViewMode>('hierarchy');
  const [hierarchyStep, setHierarchyStep] = useState<HierarchyStep>('make');
  const [hierarchyResults, setHierarchyResults] = useState(false);
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [catalogue, setCatalogue] = useState<CatalogueFilters>(
    emptyCatalogueFilters
  );
  const [hierarchy, setHierarchy] = useState(emptyHierarchySelection);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const gridFilters = useMemo(
    () => ({
      query,
      catalogue,
    }),
    [query, catalogue]
  );

  const hierarchyFilters = useMemo(
    () => ({
      query,
      selection: hierarchy,
    }),
    [query, hierarchy]
  );

  const gridParts = usePartsSearch(gridFilters);
  const hierarchyParts = useHierarchyPartsSearch(
    hierarchyFilters,
    viewMode === 'hierarchy' &&
      hierarchyResults &&
      hierarchyHasSelection(hierarchy)
  );

  const parts = viewMode === 'grid' ? gridParts : hierarchyParts;

  const favourites = useFavouriteIds(userId);
  const toggleFavourite = useToggleFavourite(userId);
  const addToCart = useAddToCart(userId);
  const cart = useCart(userId);
  const addedIds = useMemo(
    () => new Set((cart.data ?? []).map((line) => line.part.id)),
    [cart.data]
  );

  const favouriteIds = useMemo(
    () => new Set(favourites.data ?? []),
    [favourites.data]
  );

  const rows = useMemo(
    () => (parts.data?.pages ?? []).flat(),
    [parts.data?.pages]
  );

  const renderGridItem = ({ item }: ListRenderItemInfo<Part>) => (
    <PartCard
      part={item}
      categoryIcon={item.sub_group_name}
      isFavourite={favouriteIds.has(item.id)}
      onPress={() => router.push(`/part/${item.id}`)}
      onToggleFavourite={() =>
        toggleFavourite.mutate({
          partId: item.id,
          isFavourite: favouriteIds.has(item.id),
        })
      }
      addedToCart={addedIds.has(item.id)}
      onAddToCart={() => addToCart.mutate({ partId: item.id })}
    />
  );

  const renderListItem = ({ item }: ListRenderItemInfo<Part>) => (
    <PartListRow
      part={item}
      isFavourite={favouriteIds.has(item.id)}
      onPress={() => router.push(`/part/${item.id}`)}
      onToggleFavourite={() =>
        toggleFavourite.mutate({
          partId: item.id,
          isFavourite: favouriteIds.has(item.id),
        })
      }
      addedToCart={addedIds.has(item.id)}
      onAddToCart={() => addToCart.mutate({ partId: item.id })}
    />
  );

  const toggleViewMode = () => {
    setViewMode((current) => (current === 'grid' ? 'hierarchy' : 'grid'));
  };

  const handleHierarchyCommit = (next: typeof hierarchy) => {
    setHierarchy(next);
  };

  const renderCatalogueHeader = (showSearch: boolean) => (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <BrandLogo variant="header" />
        <View style={styles.titleActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              viewMode === 'grid'
                ? t('catalogue.viewHierarchy')
                : t('catalogue.viewGrid')
            }
            onPress={toggleViewMode}
            style={styles.viewToggle}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list' : 'grid'}
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('part.contactSsg')}
            disabled={!hasWhatsapp}
            onPress={() => {
              if (!hasWhatsapp || !config.ssgWhatsapp) return;
              const message = t('catalogue.whatsappMessage');
              void Linking.openURL(
                `https://wa.me/${config.ssgWhatsapp}?text=${encodeURIComponent(message)}`
              );
            }}
            style={[
              styles.whatsapp,
              hasWhatsapp ? null : styles.whatsappDisabled,
            ]}
          >
            <Ionicons
              name="logo-whatsapp"
              size={22}
              color={hasWhatsapp ? colors.success : colors.textMuted}
            />
          </Pressable>
        </View>
      </View>
      {showSearch ? (
        <SearchBar value={rawQuery} onChangeText={setRawQuery} />
      ) : null}
    </View>
  );

  if (viewMode === 'hierarchy' && !hierarchyResults) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.hierarchyShell}>
          {renderCatalogueHeader(false)}
          <View style={styles.hierarchyBody}>
            <CatalogueHierarchyPicker
              value={hierarchy}
              onChange={handleHierarchyCommit}
              step={hierarchyStep}
              onStepChange={setHierarchyStep}
              onComplete={() => setHierarchyResults(true)}
              preferredMakes={profile.data?.preferred_makes ?? []}
              preferredGroups={profile.data?.preferred_groups ?? []}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const showHierarchySummary =
    viewMode === 'hierarchy' && hierarchyResults && hierarchyHasSelection(hierarchy);

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        key={viewMode}
        data={viewMode === 'grid' || showHierarchySummary ? rows : []}
        keyExtractor={(item) => item.id}
        renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? styles.column : undefined}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (parts.hasNextPage && !parts.isFetchingNextPage) {
            void parts.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            {renderCatalogueHeader(true)}
            {viewMode === 'grid' ? (
              <CatalogueFilterBar
                value={catalogue}
                onChange={setCatalogue}
                preferredMakes={profile.data?.preferred_makes ?? []}
                preferredGroups={profile.data?.preferred_groups ?? []}
              />
            ) : showHierarchySummary ? (
              <Pressable
                style={styles.summaryBar}
                onPress={() => {
                  setHierarchyResults(false);
                  setHierarchyStep('brand');
                }}
                accessibilityRole="button"
                accessibilityLabel={t('catalogue.hierarchyEditFilters')}
              >
                <View style={styles.summaryText}>
                  <AppText variant="caption" weight="600" style={styles.summaryLabel}>
                    {t('catalogue.hierarchyTitle')}
                  </AppText>
                  <AppText variant="caption" numberOfLines={2}>
                    {[...hierarchy.makes, ...hierarchy.groups, ...hierarchy.subGroups, ...hierarchy.brands].join(
                      ' · '
                    )}
                  </AppText>
                </View>
                <AppText variant="caption" weight="600" style={styles.summaryEdit}>
                  {t('catalogue.hierarchyEditFilters')}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          parts.isPending ? (
            <View style={styles.centre}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : parts.isError ? (
            <View style={styles.centre}>
              <AppText style={styles.muted}>{t('common.error')}</AppText>
            </View>
          ) : (
            <View style={styles.centre}>
              <AppText variant="title" weight="600">
                {t('catalogue.noResults')}
              </AppText>
              <AppText style={styles.muted}>
                {t('catalogue.noResultsBody')}
              </AppText>
            </View>
          )
        }
        ListFooterComponent={
          parts.isFetchingNextPage ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    hierarchyShell: {
      flex: 1,
      paddingStart: 16,
      paddingEnd: 16,
      paddingBottom: 12,
    },
    hierarchyBody: {
      flex: 1,
      paddingTop: 4,
    },
    content: {
      paddingStart: 16,
      paddingEnd: 16,
      paddingBottom: 28,
      gap: 12,
    },
    headerBlock: {
      gap: 14,
    },
    header: {
      gap: 14,
      paddingTop: 8,
      paddingBottom: 4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    titleActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    viewToggle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    whatsapp: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.successBackground,
    },
    whatsappDisabled: {
      backgroundColor: colors.surfaceAlt,
    },
    summaryBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    summaryText: {
      flex: 1,
      gap: 4,
    },
    summaryLabel: {
      color: colors.textSecondary,
    },
    summaryEdit: {
      color: colors.accent,
    },
    column: {
      gap: 12,
    },
    centre: {
      alignItems: 'center',
      gap: 6,
      paddingTop: 48,
    },
    footer: {
      paddingTop: 16,
      paddingBottom: 8,
    },
    muted: {
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
}
