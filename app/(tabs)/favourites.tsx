import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { PartCard } from '@/components/PartCard';
import { useAuthSession } from '@/lib/auth-context';
import { useAddToCart } from '@/lib/queries/cart';
import { useFavouriteParts, useToggleFavourite } from '@/lib/queries/favourites';
import type { Part } from '@/lib/queries/parts';
import { useCategories } from '@/lib/queries/vehicles';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function FavouritesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = makeStyles(colors);

  const { session } = useAuthSession();
  const userId = session?.user.id;

  const favourites = useFavouriteParts(userId);
  const categories = useCategories();
  const toggleFavourite = useToggleFavourite(userId);
  const addToCart = useAddToCart(userId);
  const [addedIds, setAddedIds] = useState<string[]>([]);

  const iconByCategoryId = useMemo(() => {
    const map = new Map<number, string | null>();
    for (const row of categories.data ?? []) map.set(row.id, row.icon);
    return map;
  }, [categories.data]);

  const renderItem = ({ item }: ListRenderItemInfo<Part>) => (
    <PartCard
      part={item}
      categoryIcon={
        item.category_id === null
          ? null
          : iconByCategoryId.get(item.category_id) ?? null
      }
      isFavourite
      onPress={() => router.push(`/part/${item.id}`)}
      onToggleFavourite={() =>
        toggleFavourite.mutate({ partId: item.id, isFavourite: true })
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
        data={favourites.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <AppText variant="title" weight="700" style={styles.heading}>
            {t('tabs.favourites')}
          </AppText>
        }
        ListEmptyComponent={
          favourites.isPending ? (
            <View style={styles.centre}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : favourites.isError ? (
            <View style={styles.centre}>
              <AppText style={styles.muted}>{t('common.error')}</AppText>
            </View>
          ) : (
            <View style={styles.centre}>
              <Ionicons
                name="heart-outline"
                size={44}
                color={colors.textMuted}
              />
              <AppText variant="title" weight="600">
                {t('favourites.empty')}
              </AppText>
              <AppText style={styles.muted}>{t('favourites.emptyBody')}</AppText>
              <Pressable
                style={styles.button}
                accessibilityRole="button"
                onPress={() => router.replace('/(tabs)')}
              >
                <AppText weight="600" style={styles.buttonText}>
                  {t('favourites.browse')}
                </AppText>
              </Pressable>
            </View>
          )
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
    heading: {
      paddingTop: 8,
      paddingBottom: 6,
    },
    column: {
      gap: 12,
    },
    centre: {
      alignItems: 'center',
      gap: 8,
      paddingTop: 56,
    },
    muted: {
      color: colors.textSecondary,
      textAlign: 'center',
    },
    button: {
      marginTop: 10,
      height: 46,
      paddingStart: 22,
      paddingEnd: 22,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    buttonText: {
      color: colors.accentText,
    },
  });
}
