import { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }) });

import { getToken, getUser, clearAuth } from './src/storage';

import LoginScreen      from './src/screens/LoginScreen';
import RegisterScreen   from './src/screens/RegisterScreen';
import GuestQueryScreen from './src/screens/GuestQueryScreen';
import MyPackagesScreen from './src/screens/user/MyPackagesScreen';
import HistoryScreen    from './src/screens/user/HistoryScreen';
import ShelfScreen      from './src/screens/admin/ShelfScreen';
import AdminPackagesScreen from './src/screens/admin/AdminPackagesScreen';
import AddPackageScreen from './src/screens/admin/AddPackageScreen';
import AnalyticsScreen  from './src/screens/admin/AnalyticsScreen';
import PickupRecordsScreen from './src/screens/admin/PickupRecordsScreen';
import AnomalyScreen    from './src/screens/admin/AnomalyScreen';
import ProfileScreen         from './src/screens/ProfileScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import FloatingAIButton from './src/components/FloatingAIButton';

const Stack      = createNativeStackNavigator();
const AdminStack = createNativeStackNavigator();
const Tab        = createBottomTabNavigator();

function icon(name) {
  return ({ color, size }) => <Ionicons name={name} size={size} color={color} />;
}

const TAB_OPTIONS = {
  tabBarActiveTintColor: '#4f46e5',
  tabBarInactiveTintColor: '#9ca3af',
  tabBarLabelStyle: { fontSize: 11 },
  tabBarStyle: { paddingVertical: 6 },
};

function UserTabs({ onLogout }) {
  return (
    <Tab.Navigator screenOptions={TAB_OPTIONS}>
      <Tab.Screen name="我的包裹" component={MyPackagesScreen} options={{ tabBarIcon: icon('cube-outline') }} />
      <Tab.Screen name="取件历史" component={HistoryScreen}    options={{ tabBarIcon: icon('time-outline') }} />
      <Tab.Screen name="我的"    options={{ tabBarIcon: icon('person-outline') }}>
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AdminTabs({ onLogout }) {
  return (
    <Tab.Navigator screenOptions={TAB_OPTIONS}>
      <Tab.Screen name="货架总览" component={ShelfScreen}          options={{ tabBarIcon: icon('grid-outline') }} />
      <Tab.Screen name="包裹管理" component={AdminPackagesScreen}  options={{ tabBarIcon: icon('cube-outline') }} />
      <Tab.Screen name="取件记录" component={PickupRecordsScreen}  options={{ tabBarIcon: icon('receipt-outline') }} />
      <Tab.Screen name="异常处理" component={AnomalyScreen}        options={{ tabBarIcon: icon('warning-outline') }} />
      <Tab.Screen name="数据看板" component={AnalyticsScreen}      options={{ tabBarIcon: icon('bar-chart-outline') }} />
      <Tab.Screen name="我的"    options={{ tabBarIcon: icon('person-outline') }}>
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AdminRoot({ onLogout }) {
  return (
    <AdminStack.Navigator screenOptions={{ headerShown: false }}>
      <AdminStack.Screen name="AdminTabs">
        {() => <AdminTabs onLogout={onLogout} />}
      </AdminStack.Screen>
      <AdminStack.Screen
        name="AddPackage"
        component={AddPackageScreen}
        options={{ headerShown: true, title: '手动入库', headerBackTitle: '返回' }}
      />
    </AdminStack.Navigator>
  );
}

export default function App() {
  const [role,    setRole]    = useState(null); // null=loading, ''=guest, 'user', 'admin'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const user  = await getUser();
      if (token && user) setRole(user.role);
      else setRole('');
      setLoading(false);
    })();
  }, []);

  if (loading) return <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}><ActivityIndicator size="large" color="#4f46e5" /></View>;

  function handleLogin(r) { setRole(r); }
  function handleLogout() { clearAuth(); setRole(''); }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        {role === '' && (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login">
              {props => <LoginScreen {...props} onLogin={handleLogin} />}
            </Stack.Screen>
            <Stack.Screen name="Register"       component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="GuestQuery"     component={GuestQueryScreen} options={{ headerShown: false }} />
          </Stack.Navigator>
        )}
        {role === 'user'  && <UserTabs  onLogout={handleLogout} />}
        {role === 'admin' && <AdminRoot onLogout={handleLogout} />}
      </NavigationContainer>
      {(role === 'user' || role === 'admin') && <FloatingAIButton />}
    </View>
  );
}
