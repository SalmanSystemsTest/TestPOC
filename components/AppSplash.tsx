import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { AppText } from '@/components/AppText';
import { BrandLogo } from '@/components/BrandLogo';
import { brand, splashColors } from '@/lib/theme';

type Props = {
  onFinish: () => void;
};

export function AppSplash({ onFinish }: Props) {
  const { t } = useTranslation();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const tagOpacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 11,
        stiffness: 120,
        useNativeDriver: true,
      }),
      Animated.timing(tagOpacity, {
        toValue: 1,
        delay: 350,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      }),
    ]).start();

    const timer = setTimeout(onFinish, 3000);
    return () => clearTimeout(timer);
  }, [logoOpacity, logoScale, onFinish, progress, tagOpacity]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('splash.skip')}
      onPress={onFinish}
      style={styles.screen}
    >
      <Animated.View
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <BrandLogo variant="splash" />
      </Animated.View>

      <Animated.View style={[styles.tag, { opacity: tagOpacity }]}>
        <View style={styles.separator} />
        <AppText weight="600" style={styles.tagline}>
          {t('app.tagline')}
        </AppText>
        <AppText style={styles.taglineSecondary}>
          {t('app.taglineSecondary')}
        </AppText>
      </Animated.View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>
      <AppText variant="caption" style={styles.skip}>
        {t('splash.skip')}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.navy,
    padding: 40,
  },
  logo: {
    marginBottom: 30,
  },
  tag: {
    alignItems: 'center',
  },
  separator: {
    width: 44,
    height: 3,
    backgroundColor: brand.red,
    borderRadius: 2,
    marginBottom: 18,
  },
  tagline: {
    color: splashColors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 6,
    textAlign: 'center',
  },
  taglineSecondary: {
    color: splashColors.textSecondary,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
  },
  progressTrack: {
    position: 'absolute',
    bottom: 58,
    start: 60,
    end: 60,
    height: 3,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: splashColors.progressTrack,
  },
  progressFill: {
    height: '100%',
    backgroundColor: brand.red,
  },
  skip: {
    position: 'absolute',
    bottom: 28,
    start: 0,
    end: 0,
    color: splashColors.skip,
    fontSize: 11,
    textAlign: 'center',
  },
});
