import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { PartThumbnail } from '@/components/PartThumbnail';
import { QtyStepper } from '@/components/QtyStepper';
import { useAuthSession } from '@/lib/auth-context';
import { formatPkr, localisedName, toPkrNumber } from '@/lib/format';
import { buildOrderWhatsappMessage } from '@/lib/order-whatsapp';
import {
  useCart,
  useRemoveCartItem,
  useSetCartQuantity,
  useSubmitQuote,
  type SubmittedQuote,
} from '@/lib/queries/cart';
import { dispatchQuoteNotification } from '@/lib/queries/notify';
import { useProfile } from '@/lib/queries/profile';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const styles = makeStyles(colors);
  const { session } = useAuthSession();
  const userId = session?.user.id;
  const cart = useCart(userId);
  const setQuantity = useSetCartQuantity(userId);
  const remove = useRemoveCartItem(userId);
  const submit = useSubmitQuote(userId);
  const profile = useProfile(userId);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState<SubmittedQuote | null>(null);

  const handleSubmit = () => {
    const lines = cart.data ?? [];
    const capturedNote = note;
    submit.mutate(note, {
      onSuccess: (request) => {
        const text = buildOrderWhatsappMessage({
          request,
          lines,
          note: capturedNote,
          profile: profile.data ?? null,
          language: i18n.language,
          labels: {
            title: t('cart.whatsappTitle'),
            reference: t('cart.whatsappReference'),
            shop: t('cart.whatsappShop'),
            contact: t('cart.whatsappContact'),
            phone: t('cart.whatsappPhone'),
            email: t('cart.whatsappEmail'),
            city: t('cart.whatsappCity'),
            address: t('cart.whatsappAddress'),
            parts: t('cart.whatsappParts'),
            oem: t('cart.whatsappOem'),
            itemsLabel: t('cart.whatsappItems'),
            totalLabel: t('cart.whatsappTotal'),
            noteLabel: t('cart.whatsappNote'),
            followUp: t('cart.whatsappFollowUp'),
          },
        });
        void dispatchQuoteNotification({
          request,
          lines,
          note: capturedNote,
          profile: profile.data ?? null,
          message: text,
        });
        setNote('');
        setSubmitted(request);
      },
    });
  };

  const total = useMemo(
    () =>
      (cart.data ?? []).reduce(
        (sum, line) => sum + toPkrNumber(line.part.price_pkr) * line.qty,
        0
      ),
    [cart.data]
  );

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.success}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={34} color={colors.success} />
          </View>
          <AppText variant="title" weight="700" style={styles.centerText}>
            {t('cart.successTitle')}
          </AppText>
          <AppText style={[styles.muted, styles.centerText]}>
            {t('cart.successBody', { reference: submitted.reference })}
          </AppText>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/requests')}
          >
            <AppText weight="600" style={styles.primaryText}>
              {t('cart.viewRequests')}
            </AppText>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <AppText weight="600" style={styles.secondaryText}>
              {t('cart.continueBrowsing')}
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" weight="700">
          {t('cart.title')}
        </AppText>

        {cart.isPending ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : cart.isError ? (
          <AppText style={styles.muted}>{t('common.error')}</AppText>
        ) : (cart.data ?? []).length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bag-outline" size={44} color={colors.textMuted} />
            <AppText variant="title" weight="600" style={styles.centerText}>
              {t('cart.empty')}
            </AppText>
            <AppText style={[styles.muted, styles.centerText]}>
              {t('cart.emptyBody')}
            </AppText>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <AppText weight="600" style={styles.primaryText}>
                {t('favourites.browse')}
              </AppText>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.lines}>
              {(cart.data ?? []).map(({ part, qty, categoryIcon }) => (
                <View key={part.id} style={styles.line}>
                  <PartThumbnail
                    imageUrl={part.image_url}
                    categoryIcon={categoryIcon}
                  />
                  <View style={styles.lineBody}>
                    <AppText weight="600" numberOfLines={2}>
                      {localisedName(part, i18n.language)}
                    </AppText>
                    <AppText variant="caption" ltr style={styles.muted}>
                      {formatPkr(part.price_pkr)}
                    </AppText>
                    <View style={styles.lineActions}>
                      <QtyStepper
                        value={qty}
                        disabled={setQuantity.isPending}
                        onChange={(next) =>
                          setQuantity.mutate({ partId: part.id, qty: next })
                        }
                      />
                      <Pressable onPress={() => remove.mutate(part.id)}>
                        <AppText variant="caption" style={styles.remove}>
                          {t('cart.remove')}
                        </AppText>
                      </Pressable>
                    </View>
                  </View>
                  <AppText variant="caption" weight="700" ltr style={styles.linePrice}>
                    {formatPkr(toPkrNumber(part.price_pkr) * qty)}
                  </AppText>
                </View>
              ))}
            </View>

            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <AppText weight="600">{t('cart.estimatedTotal')}</AppText>
                <AppText weight="700" ltr style={styles.total}>
                  {formatPkr(total)}
                </AppText>
              </View>
              <AppText variant="caption" style={styles.muted}>
                {t('cart.indicative')}
              </AppText>
            </View>

            <View style={styles.noteBlock}>
              <AppText variant="caption" weight="600">
                {t('cart.note')}
              </AppText>
              <TextInput
                multiline
                value={note}
                onChangeText={setNote}
                placeholder={t('cart.notePlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={styles.note}
                textAlignVertical="top"
              />
            </View>

            {submit.isError ? (
              <AppText variant="caption" style={styles.error}>
                {t('cart.submitError')}
              </AppText>
            ) : null}
            <Pressable
              disabled={submit.isPending}
              style={[styles.primaryButton, submit.isPending && styles.disabled]}
              onPress={handleSubmit}
            >
              <AppText weight="600" style={styles.primaryText}>
                {submit.isPending ? t('cart.submitting') : t('cart.submit')}
              </AppText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingStart: 16,
      paddingEnd: 16,
      paddingTop: 8,
      paddingBottom: 32,
      gap: 18,
    },
    loader: { marginTop: 48 },
    lines: { gap: 10 },
    line: {
      flexDirection: 'row',
      gap: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    lineBody: { flex: 1, gap: 4 },
    lineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    linePrice: { color: colors.primary },
    remove: { color: colors.danger },
    summary: {
      gap: 8,
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.accentBackground,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    total: { color: colors.primary, fontSize: 18 },
    noteBlock: { gap: 8 },
    note: {
      minHeight: 96,
      padding: 12,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
    },
    primaryButton: {
      minHeight: 48,
      paddingStart: 20,
      paddingEnd: 20,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    primaryText: { color: colors.accentText },
    secondaryButton: {
      minHeight: 48,
      paddingStart: 20,
      paddingEnd: 20,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    secondaryText: { color: colors.primary },
    empty: { alignItems: 'center', gap: 8, paddingTop: 48 },
    success: {
      flex: 1,
      justifyContent: 'center',
      paddingStart: 24,
      paddingEnd: 24,
      gap: 12,
    },
    successIcon: {
      width: 68,
      height: 68,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 34,
      backgroundColor: colors.successBackground,
    },
    centerText: { textAlign: 'center' },
    muted: { color: colors.textSecondary },
    error: { color: colors.danger },
    disabled: { opacity: 0.55 },
  });
}
