import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useAuthSession } from '@/lib/auth-context';
import { config, hasWhatsapp } from '@/lib/config';
import { categoryArt } from '@/lib/category-art';
import { localisedName } from '@/lib/format';
import { partCardSubtitle, partDetailRows } from '@/lib/part-display';
import { useAddToCart, useCart } from '@/lib/queries/cart';
import { useFavouriteIds, useToggleFavourite } from '@/lib/queries/favourites';
import { usePart } from '@/lib/queries/parts';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function PartScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = makeStyles(colors);

  const { session } = useAuthSession();
  const userId = session?.user.id;

  const part = usePart(id);
  const favourites = useFavouriteIds(userId);
  const toggleFavourite = useToggleFavourite(userId);
  const addToCart = useAddToCart(userId);
  const cart = useCart(userId);

  const [imageFailed, setImageFailed] = useState(false);
  const added = useMemo(
    () => (cart.data ?? []).some((line) => line.part.id === id),
    [cart.data, id]
  );

  const isFavourite = useMemo(
    () => new Set(favourites.data ?? []).has(id ?? ''),
    [favourites.data, id]
  );

  if (part.isPending) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centre}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (part.isError || !part.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} colors={colors} />
        <View style={styles.centre}>
          <AppText style={styles.muted}>{t('part.notFound')}</AppText>
        </View>
      </SafeAreaView>
    );
  }

  const row = part.data;
  const artwork = categoryArt(null);
  const showImage = Boolean(row.image_url) && !imageFailed;
  const description =
    i18n.language === 'ur' && row.description_ur
      ? row.description_ur
      : row.description;

  const openWhatsapp = () => {
    if (!hasWhatsapp || !config.ssgWhatsapp) return;
    const message = t('part.whatsappMessage', {
      name: localisedName(row, i18n.language),
    });
    void Linking.openURL(
      `https://wa.me/${config.ssgWhatsapp}?text=${encodeURIComponent(message)}`
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={() => router.back()} colors={colors} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.imageWrap}>
          {showImage && row.image_url ? (
            <Image
              source={{ uri: row.image_url }}
              style={styles.image}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : artwork ? (
            <Image source={artwork} style={styles.image} resizeMode="cover" />
          ) : (
            <Ionicons name="cube-outline" size={72} color={colors.textMuted} />
          )}
          <Pressable
            style={styles.heart}
            onPress={() =>
              toggleFavourite.mutate({ partId: row.id, isFavourite })
            }
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
        </View>

        <View style={styles.block}>
          <AppText variant="title" weight="700">
            {localisedName(row, i18n.language)}
          </AppText>
          {partCardSubtitle(row) ? (
            <AppText style={styles.muted}>{partCardSubtitle(row)}</AppText>
          ) : null}
        </View>

        <View style={styles.card}>
          {partDetailRows(row).map((spec) => (
            <SpecRow
              key={spec.labelKey}
              label={t(spec.labelKey)}
              value={spec.value}
              colors={colors}
            />
          ))}
        </View>

        {description ? (
          <View style={styles.block}>
            <AppText variant="caption" weight="600" style={styles.sectionLabel}>
              {t('part.description')}
            </AppText>
            <AppText style={styles.body}>{description}</AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryButton}
            accessibilityRole="button"
            disabled={addToCart.isPending}
            onPress={() => addToCart.mutate({ partId: row.id })}
          >
            <AppText weight="600" style={styles.primaryButtonText}>
              {added ? t('part.addedToRequest') : t('part.addToRequest')}
            </AppText>
          </Pressable>

          <Pressable
            style={[
              styles.secondaryButton,
              hasWhatsapp ? null : styles.secondaryButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasWhatsapp }}
            disabled={!hasWhatsapp}
            onPress={openWhatsapp}
          >
            <Ionicons
              name="logo-whatsapp"
              size={18}
              color={hasWhatsapp ? colors.primary : colors.textMuted}
            />
            <AppText
              weight="600"
              style={hasWhatsapp ? styles.secondaryText : styles.muted}
            >
              {t('part.contactSsg')}
            </AppText>
          </Pressable>

          {hasWhatsapp ? null : (
            <AppText variant="caption" style={styles.muted}>
              {t('part.contactUnavailable')}
            </AppText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  colors,
}: {
  onBack: () => void;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
    </View>
  );
}

function SpecRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ThemeColors;
}) {
  const styles = makeStyles(colors);
  return (
    <View style={styles.specRow}>
      <AppText variant="caption" style={styles.muted}>
        {label}
      </AppText>
      <AppText variant="caption" weight="500">
        {value}
      </AppText>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingStart: 12,
      paddingEnd: 16,
      height: 44,
    },
    content: {
      paddingStart: 16,
      paddingEnd: 16,
      paddingBottom: 32,
      gap: 18,
    },
    imageWrap: {
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 16,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    heart: {
      position: 'absolute',
      top: 10,
      end: 10,
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: colors.surface,
    },
    block: {
      gap: 6,
    },
    sectionLabel: {
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    price: {
      color: colors.primary,
      fontSize: 22,
      marginTop: 4,
    },
    card: {
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingStart: 14,
      paddingEnd: 14,
      paddingTop: 4,
      paddingBottom: 4,
    },
    specRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 11,
      paddingBottom: 11,
      gap: 12,
    },
    fitmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingTop: 11,
      paddingBottom: 11,
    },
    actions: {
      gap: 10,
      marginTop: 4,
    },
    primaryButton: {
      height: 50,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    primaryButtonText: {
      color: colors.accentText,
    },
    secondaryButton: {
      height: 50,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryButtonDisabled: {
      opacity: 0.6,
    },
    secondaryText: {
      color: colors.primary,
    },
    body: {
      color: colors.textPrimary,
      flex: 1,
    },
    muted: {
      color: colors.textSecondary,
    },
    centre: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
  });
}
