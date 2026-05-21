import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';
import { t } from '@/translations';

const YELLOW = '#FFD700';
const ACCENT = '#FFC300';
const RED    = '#FF4444';

export default function AccountScreen() {
  const router = useRouter();
  const { colors, isDark, language, profile } = useAppSettings();
  const lang = language.code;
  const s = makeStyles(colors);
  const initials = profile.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

        {/* Profile */}
        <TouchableOpacity style={s.profileSection} onPress={() => router.push('/personal-info')} activeOpacity={0.8}>
          <View style={s.avatar}>
            {profile.profileImage
              ? <Image source={{ uri: profile.profileImage }} style={s.avatarImage} />
              : <Text style={s.avatarText}>{initials}</Text>
            }
          </View>
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{profile.name}</Text>
            <Text style={s.profilePhone}>{profile.phone}</Text>
          </View>
          <View style={s.editProfileBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.subText} />
          </View>
        </TouchableOpacity>

        {/* Account */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>{t('account', lang)}</Text></View>
        <View style={s.menuSection}>
          <MenuItem icon="person-circle-outline" label={t('personal_info', lang)} subtitle={t('subtitle_personal', lang)}
            onPress={() => router.push('/personal-info')} s={s} colors={colors} />
          <MenuItem icon="shield-checkmark-outline" label={t('safety', lang)} subtitle={t('subtitle_safety', lang)}
            onPress={() => router.push('/safety')} s={s} colors={colors} />
          <MenuItem icon="lock-closed-outline" label={t('login_security', lang)} subtitle={t('subtitle_login', lang)}
            onPress={() => router.push('/login-security')} s={s} colors={colors} />
        </View>

        {/* Payments */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>{t('payment', lang)} & {t('rides', lang)}</Text></View>
        <View style={s.menuSection}>
          <MenuItem icon="wallet-outline" label={t('payment', lang)} subtitle={t('subtitle_payment', lang)}
            onPress={() => router.push('/payment')} s={s} colors={colors} />
        </View>

        {/* Support */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>{t('help_support', lang)}</Text></View>
        <View style={s.menuSection}>
          <MenuItem icon="settings-outline" label={t('settings', lang)} subtitle={t('subtitle_settings', lang)}
            onPress={() => router.push('/settings')} s={s} colors={colors} />
          <MenuItem icon="help-circle-outline" label={t('help_support', lang)} subtitle={t('subtitle_support', lang)}
            onPress={() => {}} s={s} colors={colors} />
        </View>

        {/* Logout */}
        <View style={[s.menuSection, { marginTop: 8 }]}>
          <TouchableOpacity style={s.logoutItem} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={22} color={RED} />
            <Text style={s.logoutText}>{t('logout', lang)}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({ icon, label, subtitle, onPress, s, colors }: {
  icon: string; label: string; subtitle?: string;
  onPress: () => void; s: any; colors: any;
}) {
  return (
    <TouchableOpacity style={s.menuItem} activeOpacity={0.7} onPress={onPress}>
      <View style={s.iconWrapper}>
        <Ionicons name={icon as any} size={22} color={colors.text} />
      </View>
      <View style={s.menuTextBlock}>
        <Text style={s.menuLabel}>{label}</Text>
        {subtitle && <Text style={s.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subText} />
    </TouchableOpacity>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.sectionBg },
  container:     { flex: 1, backgroundColor: colors.sectionBg },
  profileSection:{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar:        { width: 70, height: 70, borderRadius: 35, backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 2, borderColor: ACCENT, overflow: 'hidden' },
  avatarImage:   { width: 70, height: 70, borderRadius: 35 },
  avatarText:    { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A' },
  profileInfo:   { flex: 1 },
  profileName:   { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  profilePhone:  { fontSize: 14, color: colors.subText },
  editProfileBtn:{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: colors.subText, textTransform: 'uppercase', letterSpacing: 0.8 },
  menuSection:   { backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
  menuItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconWrapper:   { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.iconBg, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuTextBlock: { flex: 1 },
  menuLabel:     { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  menuSubtitle:  { fontSize: 12, color: colors.subText },
  logoutItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, gap: 14 },
  logoutText:    { fontSize: 15, fontWeight: '600', color: '#FF4444' },
});
