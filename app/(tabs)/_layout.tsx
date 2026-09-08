import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useAuthSession } from '@/lib/auth-context';
import { isProfileComplete } from '@/lib/profile-complete';
import { useCartItemCount } from '@/lib/queries/cart';
import { useProfile } from '@/lib/queries/profile';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { ready, session } = useAuthSession();
  const profile = useProfile(session?.user.id);
  const cartCount = useCartItemCount(session?.user.id);
  const styles = makeStyles(colors);

  if (!ready) return null;
  if (!session) return <Redirect href={'/(auth)/sign-in' as Href} />;
  if (profile.isPending) return null;
  if (!isProfileComplete(profile.data)) {
    return <Redirect href={'/(auth)/complete-profile' as Href} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="favourites"
        options={{
          title: t('tabs.favourites'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: t('tabs.requests'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabs.cart'),
          tabBarBadge:
            (cartCount.data ?? 0) > 0 ? cartCount.data : undefined,
          tabBarBadgeStyle: styles.badge,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bag-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    tabBar: {
      height: 62,
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingTop: 4,
      paddingBottom: 3,
    },
    tabLabel: {
      fontFamily: 'Inter_400Regular',
      fontSize: 9,
      marginTop: 3,
    },
    tabItem: {
      paddingVertical: 3,
    },
    badge: {
      backgroundColor: colors.accent,
      color: colors.accentText,
      fontSize: 9,
    },
  });
}
