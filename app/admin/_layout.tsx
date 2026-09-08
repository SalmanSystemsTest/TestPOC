import { Redirect, Stack, type Href } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuthSession } from '@/lib/auth-context';
import { useProfile } from '@/lib/queries/profile';
import { useTheme, type ThemeColors } from '@/lib/theme';

export default function AdminLayout() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { session } = useAuthSession();
  const profile = useProfile(session?.user.id);

  if (!session) return <Redirect href={'/(auth)/sign-in' as Href} />;
  if (profile.isPending) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (profile.data?.role !== 'admin') {
    return <Redirect href={'/(tabs)' as Href} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    centre: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
  });
}
