// Catalogue part card. The card shell is a View so heart and add-to-cart
// never nest inside the tile Pressable — React Native Web forbids that.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { categoryArt } from '@/lib/category-art';
import { formatPkr, localisedName } from '@/lib/format';
import type { Part } from '@/lib/queries/parts';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  part: Part;
  categoryIcon: string | null;
  isFavourite: boolean;
  addedToCart?: boolean;
  onPress: () => void;
  onToggleFavourite: () => void;
  onAddToCart: () => void;
};

export function PartCard({
  part,
  categoryIcon,
  isFavourite,
  addedToCart,
  onPress,
  onToggleFavourite,
  onAddToCart,
}: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [imageFailed, setImageFailed] = useState(false);

  const photo = part.image_url && !imageFailed ? part.image_url : null;
  const artwork = categoryArt(categoryIcon);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.imageWrap}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={localisedName(part, i18n.language)}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : artwork ? (
          <Image source={artwork} style={styles.image} resizeMode="cover" />
        ) : (
          <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
        )}
      </Pressable>

      <Pressable
        style={styles.heart}
        onPress={onToggleFavourite}
        accessibilityRole="button"
        accessibilityLabel={t('part.favourite')}
        accessibilityState={{ selected: isFavourite }}
        hitSlop={8}
      >
        <Ionicons
          name={isFavourite ? 'heart' : 'heart-outline'}
          size={17}
          color={isFavourite ? colors.accent : colors.textMuted}
        />
      </Pressable>

      <View style={styles.body}>
        <Pressable onPress={onPress} accessibilityRole="button">
          <AppText variant="caption" weight="500" numberOfLines={2}>
            {localisedName(part, i18n.language)}
          </AppText>
          {part.brand ? (
            <AppText variant="caption" style={styles.brand} numberOfLines={1}>
              {part.brand}
            </AppText>
          ) : null}
          <AppText weight="700" style={styles.price}>
            {formatPkr(part.price_pkr)}
          </AppText>
        </Pressable>

        <Pressable
          style={[styles.addButton, addedToCart ? styles.addButtonDone : null]}
          onPress={onAddToCart}
          accessibilityRole="button"
          accessibilityLabel={t('part.addToRequest')}
        >
          <AppText
            variant="caption"
            weight="600"
            style={addedToCart ? styles.addTextDone : styles.addText}
          >
            {addedToCart ? t('part.addedToRequest') : t('part.addToRequest')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    imageWrap: {
      height: 118,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    heart: {
      position: 'absolute',
      top: 6,
      end: 6,
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    body: {
      padding: 10,
      gap: 6,
    },
    brand: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    price: {
      color: colors.primary,
      fontSize: 15,
      marginTop: 4,
    },
    addButton: {
      minHeight: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      paddingStart: 8,
      paddingEnd: 8,
    },
    addButtonDone: {
      backgroundColor: colors.successBackground,
    },
    addText: {
      color: colors.accentText,
    },
    addTextDone: {
      color: colors.success,
    },
  });
}
