import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

import LoginScreen from './src/screens/LoginScreen';
import CreateAccountScreen from './src/screens/CreateAccountScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import VaultScreen from './src/screens/VaultScreen';
import UnlockScreen from './src/screens/UnlockScreen';
import CreateVaultScreen from './src/screens/CreateVaultScreen';

import { colors } from './src/theme';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: '#000' },
  headerTintColor: colors.neonCyan,
  headerTitleStyle: { fontWeight: '700' },
  contentStyle: { backgroundColor: colors.bgVoid },
};

export default function App() {
  const [initialRoute, setInitialRoute] = React.useState(null);

  React.useEffect(() => {
    SecureStore.getItemAsync('vault_user').then((user) => {
      setInitialRoute(user ? 'Dashboard' : 'Login');
    });
  }, []);

  if (initialRoute === null) return null;

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={screenOptions}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateAccount" component={CreateAccountScreen} options={{ title: 'Create Account' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CreateVault" component={CreateVaultScreen} options={{ title: 'Create Vault' }} />
        <Stack.Screen name="Vault" component={VaultScreen} />
        <Stack.Screen name="Unlock" component={UnlockScreen} options={{ title: 'Unlock Vault' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
