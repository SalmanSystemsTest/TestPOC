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
import { CategoryChips } from '@/components/CategoryChips';
import { PartCard } from '@/components/PartCard';
import { SearchBar } from '@/components/SearchBar';
import {
  VehicleSelector,
  type VehicleSelection,
} from '@/components/VehicleSelector';
import { useAuthSession } from '@/lib/auth-context';
import { config, hasWhatsapp } from '@/lib/config';
import { useAddToCart } from '@/lib/queries/cart';
import { useFavouriteIds, useToggleFavourite } from '@/lib/queries/favourites';
import { usePartsSearch, type Part } from '@/lib/queries/parts';
import { useCategories } from '@/lib/queries/vehicles';
import { useTheme, type ThemeColors } from '@/lib/theme';

const SEARCH_DEBOUNCE_MS = 300;

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = makeStyles(colors);

  const { session } = useAuthSession();
  const userId = session?.user.id;

  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [vehicle, setVehicle] = useState<VehicleSelection>({
    makeId: null,
    modelId: null,
    variantId: null,
  });

  // Typing must not fire one RPC per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(rawQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const filters = useMemo(
    () => ({
      query,
      categoryId,
      makeId: vehicle.makeId,
      modelId: vehicle.modelId,
      variantId: vehicle.variantId,
    }),
    [query, categoryId, vehicle]
  );

  const categories = useCategories();
  const parts = usePartsSearch(filters);
  const favourites = useFavouriteIds(userId);
  const toggleFavourite = useToggleFavourite(userId);
  const addToCart = useAddToCart(userId);
  const [addedIds, setAddedIds] = useState<string[]>([]);

  useEffect(() => {
    setAddedIds([]);
  }, [userId]);

  const favouriteIds = useMemo(
    () => new Set(favourites.data ?? []),
    [favourites.data]
  );

  const iconByCategoryId = useMemo(() => {
    const map = new Map<number, string | null>();
    for (const row of categories.data ?? []) map.set(row.id, row.icon);
    return map;
  }, [categories.data]);

  const rows = useMemo(
    () => (parts.data?.pages ?? []).flat(),
    [parts.data?.pages]
  );

  const renderItem = ({ item }: ListRenderItemInfo<Part>) => (
    <PartCard
      part={item}
      categoryIcon={
        item.category_id === null
          ? null
          : iconByCategoryId.get(item.category_id) ?? null
      }
      isFavourite={favouriteIds.has(item.id)}
      onPress={() => router.push(`/part/${item.id}`)}
      onToggleFavourite={() =>
        toggleFavourite.mutate({
          partId: item.id,
          isFavourite: favouriteIds.has(item.id),
        })
      }
      addedToCart={addedIds.includes(item.id)}
      onAddToCart={() =>
        addToCart.mutate(
          { partId: item.id },
          { onSuccess: () => setAddedIds((ids) => [...ids, item.id]) }
        )
      }
    />
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (parts.hasNextPage && !parts.isFetchingNextPage) {
            void parts.fetchNextPage();
          }
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <AppText variant="title" weight="700" style={styles.title}>
                {t('catalogue.title')}
              </AppText>
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
            <SearchBar value={rawQuery} onChangeText={setRawQuery} />
            <VehicleSelector value={vehicle} onChange={setVehicle} />
            <CategoryChips
              categories={categories.data ?? []}
              selectedId={categoryId}
              onSelect={setCategoryId}
            />
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
    content: {
      paddingStart: 16,
      paddingEnd: 16,
      paddingBottom: 28,
      gap: 12,
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
    title: {
      flex: 1,
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
