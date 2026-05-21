import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { HapticTab } from '@/components/haptic-tab';
import { useAppSettings } from '@/context/AppSettingsContext';
import { t } from '@/translations';

const YELLOW = '#FFD700';
const GREY = '#AAAAAA';

export default function TabLayout() {
  const { isDark, language } = useAppSettings();
  const lang = language.code;
  const tabBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const tabBorder = isDark ? '#2C2C2E' : '#F0F0F0';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: YELLOW,
        tabBarInactiveTintColor: isDark ? '#666' : GREY,
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopWidth: 1,
          borderTopColor: tabBorder,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          shadowColor: '#000',
          shadowOpacity: isDark ? 0.4 : 0.1,
          shadowOffset: { width: 0, height: -4 },
          shadowRadius: 12,
          elevation: 16,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('home', lang),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="explore" options={{ title: t('rides', lang),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="car" size={size} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: t('account', lang),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}
