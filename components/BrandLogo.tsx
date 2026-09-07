import { Image, StyleSheet, View } from 'react-native';
import { useTheme, type ThemeColors } from '@/lib/theme';

type Props = {
  variant?: 'badge' | 'splash';
};

export function BrandLogo({ variant = 'badge' }: Props) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={variant === 'splash' ? styles.splash : styles.badge}>
      <Image
        source={require('@/assets/images/ssg-logo.png')}
        resizeMode="contain"
        style={variant === 'splash' ? styles.splashImage : styles.badgeImage}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary,
      borderRadius: 11,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    badgeImage: {
      width: 115,
      height: 30,
    },
    splash: {
      backgroundColor: colors.accentText,
      borderRadius: 22,
      paddingHorizontal: 34,
      paddingVertical: 28,
    },
    splashImage: {
      width: 191,
      height: 50,
    },
  });
}
