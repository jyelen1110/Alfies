import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { theme } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useOrders } from '../context/OrderContext';

import LoginScreen from '../screens/LoginScreen';
import CustomerRegistrationScreen from '../screens/CustomerRegistrationScreen';
import ShopScreen from '../screens/ShopScreen';
import CartScreen from '../screens/CartScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ApprovalsScreen from '../screens/ApprovalsScreen';
import InvoicesScreen from '../screens/InvoicesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UserListScreen from '../screens/UserListScreen';
import MasterItemListScreen from '../screens/MasterItemListScreen';
import ItemTableScreen from '../screens/ItemTableScreen';
import FavouritesScreen from '../screens/FavouritesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Logo component for header (wrapped in View to prevent button behavior)
function HeaderLogo() {
  return (
    <View pointerEvents="none" style={styles.headerLogoWrapper}>
      <Image
        source={require('../../Alfies.png')}
        style={styles.headerLogo}
        resizeMode="contain"
      />
    </View>
  );
}

function ShopStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: theme.colors.white,
        headerTitleStyle: { fontWeight: theme.fontWeight.semibold },
        headerLeft: () => <HeaderLogo />,
      }}
    >
      <Stack.Screen
        name="ShopMain"
        component={ShopScreen}
        options={{ title: 'Shop' }}
      />
      <Stack.Screen
        name="Cart"
        component={CartScreen}
        options={{ title: 'Cart' }}
      />
    </Stack.Navigator>
  );
}

function ItemsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: theme.colors.white,
        headerTitleStyle: { fontWeight: theme.fontWeight.semibold },
        headerLeft: () => <HeaderLogo />,
      }}
    >
      <Stack.Screen
        name="ItemsMain"
        component={MasterItemListScreen}
        options={({ navigation }) => ({
          title: 'Item List',
          headerRight: () => (
            <Pressable
              onPress={() => navigation.navigate('ItemTable')}
              style={{ paddingHorizontal: theme.spacing.md }}
            >
              <Ionicons name="create-outline" size={24} color={theme.colors.white} />
            </Pressable>
          ),
        })}
      />
      <Stack.Screen
        name="ItemTable"
        component={ItemTableScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function BadgeIcon({
  name,
  color,
  size,
  badgeCount,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  badgeCount?: number;
}) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {badgeCount !== undefined && badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

function MainTabs() {
  const { isOwner } = useAuth();
  const { state, getPendingApprovalCount, getCartTotal } = useOrders();

  const cartCount = state.cart.reduce((sum, c) => sum + c.quantity, 0);
  const pendingCount = getPendingApprovalCount();

  // Owner sees different tabs than users
  if (isOwner()) {
    return (
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: theme.colors.white,
          headerTitleStyle: { fontWeight: theme.fontWeight.semibold },
          headerLeft: () => <HeaderLogo />,
        }}
      >
        <Tab.Screen
          name="Items"
          component={ItemsStack}
          options={{
            headerShown: false,
            title: 'Item List',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Orders"
          component={ApprovalsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <BadgeIcon
                name="receipt"
                color={color}
                size={size}
                badgeCount={pendingCount}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Invoices"
          component={InvoicesScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Users"
          component={UserListScreen}
          options={{
            title: 'Customers',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    );
  }

  // Regular users (customers) see Favourites, Item List, Orders, Invoices, Settings
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: theme.colors.white,
        headerTitleStyle: { fontWeight: theme.fontWeight.semibold },
        headerLeft: () => <HeaderLogo />,
      }}
    >
      <Tab.Screen
        name="Favourites"
        component={FavouritesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ItemList"
        component={ShopStack}
        options={{
          headerShown: false,
          title: 'Item List',
          tabBarIcon: ({ color, size }) => (
            <BadgeIcon name="list" color={color} size={size} badgeCount={cartCount} />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Invoices"
        component={InvoicesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Image
          source={require('../../Alfies.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <Text style={styles.loadingText}>Alfie's Food Co.</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <MainTabs /> : <LoginStack />}
    </NavigationContainer>
  );
}

function LoginStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="CustomerRegistration" component={CustomerRegistrationScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    gap: theme.spacing.md,
  },
  loadingText: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
  },
  headerLogoWrapper: {
    marginLeft: theme.spacing.md,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  loadingLogo: {
    width: 100,
    height: 100,
  },
});
