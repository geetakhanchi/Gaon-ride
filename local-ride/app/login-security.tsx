import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';
import { t } from '@/translations';

const YELLOW = '#FFD700';
const ACCENT = '#FFC300';
const GREEN = '#22C55E';

type ModalType = 'email' | 'phone' | null;

export default function LoginSecurityScreen() {
  const router = useRouter();
  const { colors, isDark, language } = useAppSettings();
  const lang = language.code;
  const s = makeStyles(colors);

  const [linkedEmail, setLinkedEmail] = useState<string | null>(null);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [inputValue, setInputValue] = useState('');

  const openModal = (type: ModalType) => { setInputValue(''); setModalType(type); };
  const closeModal = () => { setInputValue(''); setModalType(null); };

  const handleLink = () => {
    if (modalType === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputValue.trim())) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        return;
      }
      setLinkedEmail(inputValue.trim());
    } else if (modalType === 'phone') {
      if (inputValue.replace(/\D/g, '').length < 10) {
        Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
        return;
      }
      setLinkedPhone(inputValue.trim());
    }
    closeModal();
  };

  const handleUnlink = (type: 'email' | 'phone') => {
    Alert.alert(
      'Unlink Account',
      `Are you sure you want to unlink your ${type === 'email' ? 'email' : 'phone number'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unlink', style: 'destructive', onPress: () => type === 'email' ? setLinkedEmail(null) : setLinkedPhone(null) },
      ]
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('login_security', lang)}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.banner}>
          <View style={s.bannerIcon}>
            <Ionicons name="shield-checkmark" size={28} color="#1A1A1A" />
          </View>
          <View style={s.bannerText}>
            <Text style={s.bannerTitle}>Secure your account</Text>
            <Text style={s.bannerSub}>Link your email and phone number to keep your account safe and easily log in.</Text>
          </View>
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Login Methods</Text>
        </View>

        <View style={s.card}>
          <LoginRow icon="mail-outline" title={t('login_by_email', lang)} linkedValue={linkedEmail} linkedLabel={linkedEmail ?? 'Not linked'}
            onLink={() => openModal('email')} onUnlink={() => handleUnlink('email')} s={s} colors={colors} lang={lang} />
          <View style={s.divider} />
          <LoginRow icon="call-outline" title={t('login_by_phone', lang)} linkedValue={linkedPhone} linkedLabel={linkedPhone ?? 'Not linked'}
            onLink={() => openModal('phone')} onUnlink={() => handleUnlink('phone')} s={s} colors={colors} lang={lang} />
        </View>

        <View style={s.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={colors.subText} style={{ marginTop: 1 }} />
          <Text style={s.noteText}>Linking multiple login methods makes it easier to access your account if you ever get locked out.</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={modalType !== null} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={closeModal} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{modalType === 'email' ? 'Link Email Address' : 'Link Phone Number'}</Text>
            <Text style={s.modalSub}>
              {modalType === 'email' ? 'Enter your email address to link it with your account.' : 'Enter your phone number to link it with your account.'}
            </Text>

            <View style={s.inputWrapper}>
              <Ionicons name={modalType === 'email' ? 'mail-outline' : 'call-outline'} size={20} color={ACCENT} style={s.inputIcon} />
              <TextInput style={s.modalInput} placeholder={modalType === 'email' ? 'you@example.com' : '+91 XXXXX XXXXX'}
                placeholderTextColor={colors.subText} value={inputValue} onChangeText={setInputValue}
                keyboardType={modalType === 'email' ? 'email-address' : 'phone-pad'} autoCapitalize="none" autoFocus />
            </View>

            <TouchableOpacity style={s.linkBtn} onPress={handleLink} activeOpacity={0.85}>
              <Ionicons name="link-outline" size={18} color="#1A1A1A" />
              <Text style={s.linkBtnText}>{t('link_now', lang)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.cancelModalBtn} onPress={closeModal} activeOpacity={0.7}>
              <Text style={s.cancelModalText}>{t('cancel', lang)}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function LoginRow({ icon, title, linkedValue, linkedLabel, onLink, onUnlink, s, colors, lang }: {
  icon: string; title: string; linkedValue: string | null; linkedLabel: string;
  onLink: () => void; onUnlink: () => void; s: any; colors: any; lang: string;
}) {
  const isLinked = linkedValue !== null;
  return (
    <View style={s.loginRow}>
      <View style={s.loginLeft}>
        <View style={[s.loginIconBox, isLinked && s.loginIconBoxLinked]}>
          <Ionicons name={icon as any} size={20} color={isLinked ? GREEN : colors.text} />
        </View>
        <View style={s.loginTextBlock}>
          <Text style={s.loginTitle}>{title}</Text>
          <View style={s.loginStatusRow}>
            {isLinked && <View style={s.linkedDot} />}
            <Text style={[s.loginStatus, isLinked && s.loginStatusLinked]}>{isLinked ? linkedLabel : 'Not linked'}</Text>
          </View>
        </View>
      </View>
      <View style={s.loginRight}>
        {isLinked ? (
          <View style={s.linkedActions}>
            <TouchableOpacity style={s.changeBtn} onPress={onLink} activeOpacity={0.8}>
              <Text style={s.changeBtnText}>{t('change', lang)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onUnlink} activeOpacity={0.8} style={s.unlinkBtn}>
              <Ionicons name="close-circle-outline" size={18} color="#FF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.linkPill} onPress={onLink} activeOpacity={0.8}>
            <Ionicons name="link-outline" size={14} color="#1A1A1A" />
            <Text style={s.linkPillText}>{t('link', lang)}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.bg },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.header, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  headerTitle:     { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: 0.3 },
  container:       { flex: 1, backgroundColor: colors.bg },
  banner:          { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: YELLOW, marginHorizontal: 16, marginTop: 20, borderRadius: 16, padding: 16, gap: 12, shadowColor: ACCENT, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4 },
  bannerIcon:      { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.08)', justifyContent: 'center', alignItems: 'center' },
  bannerText:      { flex: 1 },
  bannerTitle:     { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  bannerSub:       { fontSize: 12, color: '#444', lineHeight: 17 },
  sectionHeader:   { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle:    { fontSize: 12, fontWeight: '700', color: colors.subText, textTransform: 'uppercase', letterSpacing: 0.8 },
  card:            { backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3, overflow: 'hidden' },
  divider:         { height: 1, backgroundColor: colors.border, marginLeft: 70 },
  loginRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, minHeight: 72 },
  loginLeft:       { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  loginIconBox:    { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  loginIconBoxLinked:{ backgroundColor: colors.card, borderColor: '#BBF7D0' },
  loginTextBlock:  { flex: 1 },
  loginTitle:      { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  loginStatusRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  linkedDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  loginStatus:     { fontSize: 12, color: colors.subText, flexShrink: 1 },
  loginStatusLinked:{ color: GREEN, fontWeight: '500' },
  loginRight:      { marginLeft: 8, alignItems: 'flex-end' },
  linkedActions:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changeBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  changeBtnText:   { fontSize: 13, color: colors.text, fontWeight: '600' },
  unlinkBtn:       { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  linkPill:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: YELLOW, gap: 5, shadowColor: ACCENT, shadowOpacity: 0.25, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  linkPillText:    { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  noteBox:         { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 20, marginTop: 16, gap: 8 },
  noteText:        { flex: 1, fontSize: 12, color: colors.subText, lineHeight: 18 },
  modalOverlay:    { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:      { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
  modalHandle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  modalSub:        { fontSize: 13, color: colors.subText, lineHeight: 19, marginBottom: 20 },
  inputWrapper:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 12, borderWidth: 1.5, borderColor: ACCENT, paddingHorizontal: 14, marginBottom: 20 },
  inputIcon:       { marginRight: 10 },
  modalInput:      { flex: 1, height: 50, fontSize: 15, color: colors.text },
  linkBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: YELLOW, borderRadius: 14, paddingVertical: 14, gap: 8, marginBottom: 10 },
  linkBtnText:     { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  cancelModalBtn:  { alignItems: 'center', paddingVertical: 12 },
  cancelModalText: { fontSize: 14, color: colors.subText, fontWeight: '500' },
});
