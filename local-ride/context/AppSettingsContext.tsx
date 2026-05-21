import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──────────────────────────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Language {
  code: string;
  label: string;
  native: string;
}

export interface ThemeColors {
  bg: string;
  card: string;
  text: string;
  subText: string;
  border: string;
  header: string;
  headerText: string;
  inputBg: string;
  iconBg: string;
  sectionBg: string;
}

// ── Theme palettes ─────────────────────────────────────────────────────────
const LIGHT_COLORS: ThemeColors = {
  bg: '#F5F5F5',
  card: '#FFFFFF',
  text: '#1A1A1A',
  subText: '#777777',
  border: '#E8E8E8',
  header: '#FFFFFF',
  headerText: '#1A1A1A',
  inputBg: '#F9F9F9',
  iconBg: '#F5F5F5',
  sectionBg: '#F5F5F5',
};

const DARK_COLORS: ThemeColors = {
  bg: '#0F0F0F',
  card: '#1C1C1E',
  text: '#FFFFFF',
  subText: '#AAAAAA',
  border: '#2C2C2E',
  header: '#1C1C1E',
  headerText: '#FFFFFF',
  inputBg: '#2C2C2E',
  iconBg: '#2C2C2E',
  sectionBg: '#0F0F0F',
};

// ── Profile ────────────────────────────────────────────────────────────────
export interface UserProfile {
  name: string;
  phone: string;
  email: string;
  profileImage: string | null;
}

const DEFAULT_PROFILE: UserProfile = {
  name: 'Geeta Khanchi',
  phone: '+91 98765 43210',
  email: 'geeta@example.com',
  profileImage: null,
};

// ── Context shape ──────────────────────────────────────────────────────────
interface AppSettingsContextValue {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  isDark: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  themeMode: 'system',
  setThemeMode: () => {},
  colors: LIGHT_COLORS,
  isDark: false,
  language: { code: 'en-GB', label: 'British English', native: 'English (UK)' },
  setLanguage: () => {},
  profile: DEFAULT_PROFILE,
  setProfile: () => {},
});

// ── Provider ───────────────────────────────────────────────────────────────
export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [language, setLanguageState] = useState<Language>({
    code: 'en-GB', label: 'British English', native: 'English (UK)',
  });
  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE);

  // Load persisted settings
  useEffect(() => {
    AsyncStorage.multiGet(['@theme', '@language', '@profile']).then(pairs => {
      const themeVal   = pairs[0][1];
      const langVal    = pairs[1][1];
      const profileVal = pairs[2][1];
      if (themeVal)   setThemeModeState(themeVal as ThemeMode);
      if (langVal)    setLanguageState(JSON.parse(langVal));
      if (profileVal) setProfileState(JSON.parse(profileVal));
    });
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem('@theme', mode);
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem('@language', JSON.stringify(lang));
  }, []);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    AsyncStorage.setItem('@profile', JSON.stringify(p));
  }, []);

  const resolvedDark =
    themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';
  const colors = resolvedDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <AppSettingsContext.Provider value={{
      themeMode, setThemeMode, colors, isDark: resolvedDark,
      language, setLanguage,
      profile, setProfile,
    }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────
export const useAppSettings = () => useContext(AppSettingsContext);
