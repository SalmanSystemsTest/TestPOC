import { useTranslation } from 'react-i18next';
import { Image, StyleSheet } from 'react-native';

type Props = {
  variant?: 'badge' | 'splash' | 'header';
};

const sizes = {
  badge: { width: 168, height: 44 },
  splash: { width: 260, height: 68 },
  header: { width: 140, height: 37 },
} as const;

export function BrandLogo({ variant = 'badge' }: Props) {
  const { t } = useTranslation();

  return (
    <Image
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('app.name')}
      source={require('@/assets/images/ssg-logo.png')}
      resizeMode="contain"
      style={[styles.image, sizes[variant]]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    borderRadius: 6,
  },
});
