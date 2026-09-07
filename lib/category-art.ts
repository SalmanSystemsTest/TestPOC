// Stable category artwork for catalogue tiles. Most seeded parts have no
// photograph; a consistent local image is better than a blank glyph.

import type { ImageSourcePropType } from 'react-native';

const CATEGORY_ART: Record<string, ImageSourcePropType> = {
  brakes: require('../assets/images/categories/category-brakes.png'),
  filters: require('../assets/images/categories/category-filters.png'),
  engine: require('../assets/images/categories/category-engine.png'),
  electrical: require('../assets/images/categories/category-electrical.png'),
  suspension: require('../assets/images/categories/category-suspension.png'),
  cooling: require('../assets/images/categories/category-cooling.png'),
  lighting: require('../assets/images/categories/category-lighting.png'),
};

export function categoryArt(
  slug: string | null | undefined
): ImageSourcePropType | null {
  if (!slug) return null;
  return CATEGORY_ART[slug] ?? null;
}
