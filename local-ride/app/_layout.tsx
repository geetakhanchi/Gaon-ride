import 'react-native-reanimated';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppSettingsProvider, useAppSettings } from '@/context/AppSettingsContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ActiveRideProvider } from '@/context/ActiveRideContext';
import GlobalRideOverlay from '@/components/GlobalRideOverlay';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function AppNavigator() {
  const { isDark } = useAppSettings();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)"         options={{ headerShown: false }} />
        <Stack.Screen name="modal"          options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="booking"        options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="payment"        options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="safety"         options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="personal-info"  options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="login-security" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="settings"       options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications"  options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="live-trip"      options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <GlobalRideOverlay />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <NotificationProvider>
        <ActiveRideProvider>
          <AppNavigator />
        </ActiveRideProvider>
      </NotificationProvider>
    </AppSettingsProvider>
  );
}
