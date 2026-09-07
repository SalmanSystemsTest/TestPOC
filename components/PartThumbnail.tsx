// Shared part image: catalogue photo, then category artwork, then glyph.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { categoryArt } from '@/lib/category-art';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  imageUrl: string | null;
  categoryIcon: string | null;
};

export function PartThumbnail({ imageUrl, categoryIcon }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [failed, setFailed] = useState(false);
  const photo = imageUrl && !failed ? imageUrl : null;
  const artwork = categoryArt(categoryIcon);

  return (
    <View style={styles.wrap}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : artwork ? (
        <Image source={artwork} style={styles.image} resizeMode="cover" />
      ) : (
        <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      width: 64,
      height: 64,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
  });
}
