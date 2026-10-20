import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from '@/components/AppText';
import { categoryArt } from '@/lib/category-art';
import { localisedName } from '@/lib/format';
import { partCardSubtitle } from '@/lib/part-display';
import type { Part } from '@/lib/queries/parts';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  part: Part;
  isFavourite: boolean;
  addedToCart?: boolean;
  onPress: () => void;
  onToggleFavourite: () => void;
  onAddToCart: () => void;
};

export function PartListRow({
  part,
  isFavourite,
  addedToCart,
  onPress,
  onToggleFavourite,
  onAddToCart,
}: Props) {
  const { i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [imageFailed, setImageFailed] = useState(false);

  const photo = part.image_url && !imageFailed ? part.image_url : null;
  const artwork = categoryArt(part.sub_group_name);

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.thumbWrap}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={localisedName(part, i18n.language)}
      >
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={styles.thumb}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : artwork ? (
          <Image source={artwork} style={styles.thumb} resizeMode="cover" />
        ) : (
          <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
        )}
      </Pressable>

      <Pressable style={styles.main} onPress={onPress} accessibilityRole="button">
        <AppText weight="600" numberOfLines={2}>
          {localisedName(part, i18n.language)}
        </AppText>
        <AppText variant="caption" numberOfLines={2} style={styles.sub}>
          {partCardSubtitle(part)}
        </AppText>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={onToggleFavourite}
          accessibilityRole="button"
          accessibilityState={{ selected: isFavourite }}
          hitSlop={8}
        >
          <Ionicons
            name={isFavourite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavourite ? colors.accent : colors.textMuted}
          />
        </Pressable>
        <Pressable
          onPress={onAddToCart}
          accessibilityRole="button"
          accessibilityState={{ selected: Boolean(addedToCart) }}
          hitSlop={8}
        >
          <Ionicons
            name={addedToCart ? 'checkmark-circle' : 'cart-outline'}
            size={22}
            color={addedToCart ? colors.success : colors.accent}
          />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    thumbWrap: {
      width: 56,
      height: 56,
      borderRadius: 10,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
    },
    thumb: {
      width: 56,
      height: 56,
    },
    main: {
      flex: 1,
      gap: 4,
    },
    sub: {
      color: colors.textSecondary,
    },
    actions: {
      alignItems: 'center',
      gap: 10,
    },
  });
}
