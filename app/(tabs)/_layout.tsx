import { Tabs, Link, usePathname } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { OfflineBanner } from '@/lib/OfflineBanner';
import { colors, fonts, tapTarget } from '@/theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: Array<{ name: string; href: '/' | '/recipes' | '/groceries' | '/pantry' | '/ideas'; label: string; icon: IconName }> = [
  { name: 'index', href: '/', label: 'Plan', icon: 'calendar-outline' },
  { name: 'recipes', href: '/recipes', label: 'Recipes', icon: 'book-outline' },
  { name: 'groceries', href: '/groceries', label: 'Groceries', icon: 'cart-outline' },
  { name: 'pantry', href: '/pantry', label: 'Pantry', icon: 'file-tray-stacked-outline' },
  { name: 'ideas', href: '/ideas', label: 'Ideas', icon: 'bulb-outline' },
];

// Wide browser windows get a rail drawn here, with Household at the bottom;
// phones (native or web) use the navigator's bottom bar and the header icon.
const SIDE_NAV_MIN_WIDTH = 768;

// The active tab is a filled green block behind icon and label, both white.
function TabBlock({ icon, label, active }: { icon: IconName; label: string; active: boolean }) {
  return (
    <View style={[block.base, active && block.active]}>
      <Ionicons name={icon} color={active ? colors.accentInk : colors.muted} size={22} />
      <Text style={[block.label, active && block.labelActive]}>{label}</Text>
    </View>
  );
}

function tab(name: IconName, label: string): (props: { color: ColorValue; size: number; focused: boolean }) => React.ReactNode {
  return ({ focused }) => <TabBlock icon={name} label={label} active={focused} />;
}

function Rail() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <View style={rail.wrap}>
      {TABS.map((t) => (
        <Link key={t.name} href={t.href} asChild>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: isActive(t.href) }} style={({ pressed }) => [rail.item, pressed && { opacity: 0.8 }]}>
            <TabBlock icon={t.icon} label={t.label} active={isActive(t.href)} />
          </Pressable>
        </Link>
      ))}
      <View style={{ flex: 1 }} />
      <Link href="/settings" asChild>
        <Pressable accessibilityRole="button" accessibilityLabel="Household settings" style={({ pressed }) => [rail.item, pressed && { opacity: 0.8 }]}>
          <TabBlock icon="people-outline" label="Household" active={pathname.startsWith('/settings')} />
        </Pressable>
      </Link>
    </View>
  );
}

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const sideNav = Platform.OS === 'web' && width >= SIDE_NAV_MIN_WIDTH;

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {sideNav ? <Rail /> : null}
        <View style={{ flex: 1 }}>
          <Tabs
            screenOptions={{
              headerShown: true,
              headerStyle: { backgroundColor: colors.ground },
              headerShadowVisible: false,
              headerTitleStyle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: colors.muted,
              tabBarShowLabel: false,
              tabBarItemStyle: { paddingVertical: 2 },
              tabBarStyle: sideNav ? { display: 'none' } : { backgroundColor: colors.surface, borderTopColor: colors.rule, paddingTop: 10 },
              sceneStyle: { backgroundColor: colors.ground },
              headerRight: sideNav
                ? undefined
                : () => (
                    <Link href="/settings" asChild>
                      <Pressable accessibilityLabel="Household settings" hitSlop={8} style={{ minWidth: tapTarget, alignItems: 'center' }}>
                        <Ionicons name="people-outline" size={24} color={colors.ink} />
                      </Pressable>
                    </Link>
                  ),
            }}
          >
            {TABS.map((t) => (
              <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label, headerShown: t.name !== 'recipes', tabBarIcon: tab(t.icon, t.label) }} />
            ))}
          </Tabs>
        </View>
      </View>
    </View>
  );
}

const block = StyleSheet.create({
  base: { width: 66, height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  active: { backgroundColor: colors.accent },
  label: { fontFamily: fonts.bodySemibold, fontSize: 11, color: colors.muted },
  labelActive: { color: colors.accentInk },
});

const rail = StyleSheet.create({
  wrap: { width: 104, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.rule, paddingVertical: 12, alignItems: 'center', gap: 6 },
  item: { paddingVertical: 2 },
});
