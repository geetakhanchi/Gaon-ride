import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, Modal, KeyboardAvoidingView, Platform, TextInput, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';
import { t } from '@/translations';

const YELLOW = '#FFD700';
const RED    = '#FF4444';

const DEMO_EMAIL = 'geeta@example.com';
const DEMO_PHONE = '9876543210';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, isDark, themeMode, setThemeMode, language, setLanguage } = useAppSettings();
  const s = makeStyles(colors);
  const lang = language.code;

  const [langModalVisible, setLangModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const INDIAN_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
    { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  ];

  const THEME_OPTIONS = [
    { id: 'system', label: t('system_default', lang), icon: 'settings-outline' },
    { id: 'light',  label: t('light_mode', lang),     icon: 'sunny-outline' },
    { id: 'dark',   label: t('dark_mode', lang),      icon: 'moon-outline' },
  ] as const;

  const handleDeleteAccount = () => {
    const val = deleteInput.trim();
    if (val === DEMO_EMAIL || val === DEMO_PHONE) {
      setDeleteModalVisible(false);
      setDeleteInput('');
      Alert.alert('Account Deleted', 'Your account has been successfully deleted. You will be logged out.', [
        { text: 'OK', onPress: () => router.replace('/') }
      ]);
    } else {
      Alert.alert('Verification Failed', 'The email or phone number doesn\'t match your account.');
    }
  };

  const openLink = (url: string) => Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('settings', lang)}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        {/* APP PREFERENCES */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t('app_preferences', lang)}</Text>
        </View>
        <View style={s.card}>
          <SettingsRow icon="language-outline" label={t('language', lang)} value={language.nativeName}
            onPress={() => setLangModalVisible(true)} s={s} colors={colors} />
          <View style={s.divider} />
          <SettingsRow icon={isDark ? 'moon-outline' : 'sunny-outline'} label={t('theme', lang)}
            value={THEME_OPTIONS.find(t => t.id === themeMode)?.label ?? 'System'}
            onPress={() => setThemeModalVisible(true)} s={s} colors={colors} />
        </View>

        {/* ACCOUNT */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t('account', lang)}</Text>
        </View>
        <View style={s.card}>
          <TouchableOpacity style={[s.settingsRow, { paddingVertical: 18 }]} onPress={() => setDeleteModalVisible(true)} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={22} color={RED} style={s.rowIcon} />
            <Text style={[s.rowLabel, { color: RED, fontWeight: '600' }]}>{t('delete_account', lang)}</Text>
          </TouchableOpacity>
        </View>

        {/* ABOUT & LEGAL */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t('about', lang)}</Text>
        </View>
        <View style={s.card}>
          <SettingsRow icon="logo-facebook" label={t('like_us_facebook', lang)}
            onPress={() => openLink('https://facebook.com')} isLink s={s} colors={colors} />
          <View style={s.divider} />
          <SettingsRow icon="logo-instagram" label={t('like_us_instagram', lang)}
            onPress={() => openLink('https://instagram.com')} isLink s={s} colors={colors} />
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{t('legal', lang)}</Text>
        </View>
        <View style={s.card}>
          <SettingsRow icon="document-text-outline" label={t('privacy_policy', lang)}
            onPress={() => openLink('https://example.com/privacy')} s={s} colors={colors} />
          <View style={s.divider} />
          <SettingsRow icon="shield-checkmark-outline" label={t('terms_conditions', lang)}
            onPress={() => openLink('https://example.com/terms')} s={s} colors={colors} />
          <View style={s.divider} />
          <SettingsRow icon="business-outline" label={t('company_overview', lang)}
            onPress={() => openLink('https://example.com/about')} s={s} colors={colors} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* LANGUAGE MODAL */}
      <Modal visible={langModalVisible} transparent animationType="slide" onRequestClose={() => setLangModalVisible(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setLangModalVisible(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Select Language</Text>
          <ScrollView style={s.modalScroll} showsVerticalScrollIndicator={false}>
            {INDIAN_LANGUAGES.map((l) => (
              <TouchableOpacity key={l.code} style={s.radioRow} onPress={() => { setLanguage(l); setLangModalVisible(false); }}>
                <Text style={s.radioLabel}>{l.nativeName} ({l.name})</Text>
                <View style={[s.radioCircle, language.code === l.code && s.radioCircleSelected]}>
                  {language.code === l.code && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* THEME MODAL */}
      <Modal visible={themeModalVisible} transparent animationType="slide" onRequestClose={() => setThemeModalVisible(false)}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setThemeModalVisible(false)} />
        <View style={[s.modalSheet, { paddingBottom: 40 }]}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>{t('theme', lang)}</Text>
          {THEME_OPTIONS.map((tOp) => (
            <TouchableOpacity key={tOp.id} style={s.radioRow} onPress={() => { setThemeMode(tOp.id); setThemeModalVisible(false); }}>
              <Ionicons name={tOp.icon as any} size={20} color={colors.text} style={{ marginRight: 12 }} />
              <Text style={[s.radioLabel, { flex: 1 }]}>{tOp.label}</Text>
              <View style={[s.radioCircle, themeMode === tOp.id && s.radioCircleSelected]}>
                {themeMode === tOp.id && <View style={s.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* DELETE MODAL */}
      <Modal visible={deleteModalVisible} transparent animationType="slide" onRequestClose={() => setDeleteModalVisible(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setDeleteModalVisible(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('delete_account', lang)}</Text>
            <Text style={s.modalSub}>
              This action cannot be undone. To verify, please enter your registered email address or phone number.
            </Text>
            <View style={s.inputWrapper}>
              <Ionicons name="shield-checkmark-outline" size={20} color={RED} style={s.inputIcon} />
              <TextInput style={s.modalInput} placeholder="Email or Phone Number" placeholderTextColor={colors.subText}
                value={deleteInput} onChangeText={setDeleteInput} autoCapitalize="none" autoFocus />
            </View>
            <TouchableOpacity style={s.deleteBtn} onPress={handleDeleteAccount} activeOpacity={0.85}>
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={s.deleteBtnText}>Confirm Deletion</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelModalBtn} onPress={() => setDeleteModalVisible(false)} activeOpacity={0.7}>
              <Text style={s.cancelModalText}>{t('cancel', lang)}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function SettingsRow({ icon, label, value, isLink, onPress, s, colors }: {
  icon: string; label: string; value?: string; isLink?: boolean;
  onPress: () => void; s: any; colors: any;
}) {
  return (
    <TouchableOpacity style={s.settingsRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={22} color={isLink ? '#1877F2' : colors.text} style={s.rowIcon} />
      <Text style={[s.rowLabel, isLink && { color: '#1877F2' }]}>{label}</Text>
      {value && <Text style={s.rowValue}>{value}</Text>}
      {!isLink && <Ionicons name="chevron-forward" size={18} color={colors.subText} />}
    </TouchableOpacity>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe:          { flex: 1, backgroundColor: colors.bg },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.header, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: 0.3 },
  container:     { flex: 1, backgroundColor: colors.bg },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: colors.subText, textTransform: 'uppercase', letterSpacing: 0.8 },
  card:          { backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  divider:       { height: 1, backgroundColor: colors.border, marginLeft: 52 },
  settingsRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  rowIcon:       { marginRight: 14 },
  rowLabel:      { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  rowValue:      { fontSize: 14, color: colors.subText, marginRight: 8 },
  modalOverlay:  { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', position: 'absolute', width: '100%', height: '100%' },
  modalSheet:    { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%', position: 'absolute', bottom: 0, width: '100%' },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle:    { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  modalSub:      { fontSize: 13, color: colors.subText, lineHeight: 19, marginBottom: 20 },
  modalScroll:   { maxHeight: 400 },
  radioRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  radioLabel:    { fontSize: 16, color: colors.text },
  radioCircle:   { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.subText, justifyContent: 'center', alignItems: 'center' },
  radioCircleSelected: { borderColor: YELLOW },
  radioDot:      { width: 10, height: 10, borderRadius: 5, backgroundColor: YELLOW },
  inputWrapper:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1.5, borderColor: RED, paddingHorizontal: 14, marginBottom: 20 },
  inputIcon:     { marginRight: 10 },
  modalInput:    { flex: 1, height: 50, fontSize: 15, color: colors.text },
  deleteBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: RED, borderRadius: 14, paddingVertical: 14, gap: 8, marginBottom: 10 },
  deleteBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelModalBtn:{ alignItems: 'center', paddingVertical: 12 },
  cancelModalText:{ fontSize: 14, color: colors.subText, fontWeight: '500' },
});
