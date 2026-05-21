/**
 * Safety Hub — Gaon Ride
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Alert, Linking, TextInput, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';

const YELLOW    = '#FFC82C';
const GREEN     = '#2E7D32';
const BLUE      = '#1565C0';
const SOS_RED   = '#D32F2F';

const STORAGE_KEY = 'gaon_trusted_contacts';

interface Contact { id: string; name: string; phone: string }

export default function SafetyScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppSettings();
  const s = makeStyles(colors, isDark);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [otpChecked, setOtpChecked] = useState(false);

  // Load saved contacts
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) setContacts(JSON.parse(raw));
    });
  }, []);

  const saveContacts = useCallback(async (list: Contact[]) => {
    setContacts(list);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  // ── Add contact ─────────────────────────────────────────────────────────────
  const confirmAddContact = () => {
    if (!newName.trim() || newPhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Invalid details', 'Enter a full name and valid 10-digit mobile number.');
      return;
    }
    const updated = [...contacts, { id: Date.now().toString(), name: newName.trim(), phone: newPhone.trim() }];
    saveContacts(updated);
    setNewName(''); setNewPhone(''); setAddModal(false);
  };

  const removeContact = (id: string) => {
    Alert.alert('Remove contact?', 'This contact will no longer receive alerts.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => saveContacts(contacts.filter(c => c.id !== id)) },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Safety Hub</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── RIDE OTP VERIFICATION ────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Ride OTP Verification</Text>
        <View style={s.card}>
          <Text style={s.cardNote}>
            Always make sure the driver asks for your OTP before you board. Never share the OTP before entering the vehicle.
          </Text>
          <TouchableOpacity
            style={s.checkRow}
            onPress={() => setOtpChecked(v => !v)}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="numeric" size={22} color={otpChecked ? GREEN : '#888'} />
            <Text style={[s.checkLabel, otpChecked && { color: GREEN }]}>Driver asked for your ride OTP</Text>
            <View style={[s.checkbox, otpChecked && { backgroundColor: GREEN, borderColor: GREEN }]}>
              {otpChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
          <View style={[s.boardingResult, { backgroundColor: otpChecked ? GREEN + '18' : SOS_RED + '10' }]}>
            <Ionicons name={otpChecked ? 'shield-checkmark' : 'shield-half'} size={20} color={otpChecked ? GREEN : SOS_RED} />
            <Text style={[s.boardingResultTxt, { color: otpChecked ? GREEN : SOS_RED }]}>
              {otpChecked ? 'OTP verified — safe to board!' : 'Wait for driver to ask your OTP before boarding'}
            </Text>
          </View>
        </View>

        {/* ── TRUSTED CONTACTS ─────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Trusted Contacts</Text>
        <View style={s.card}>
          <Text style={s.cardNote}>
            These contacts receive automatic alerts when you press SOS and receive your trip details when you tap "Share Trip".
          </Text>
          {contacts.map((c, idx) => (
            <React.Fragment key={c.id}>
              {idx > 0 && <View style={s.divider} />}
              <View style={s.contactRow}>
                <View style={s.contactAvatar}>
                  <Text style={s.contactAvatarTxt}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={s.contactInfo}>
                  <Text style={s.contactName}>{c.name}</Text>
                  <Text style={s.contactPhone}>{c.phone}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    const url = `tel:${c.phone}`;
                    Linking.canOpenURL(url)
                      .then(supported => {
                        if (supported) return Linking.openURL(url);
                        Alert.alert('Cannot call', `Calling is not supported on this device.\nNumber: ${c.phone}`);
                      })
                      .catch(() => Alert.alert('Cannot call', `Unable to open dialer for ${c.phone}`));
                  }}
                  style={s.contactAction}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="call-outline" size={20} color={GREEN} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeContact(c.id)} style={s.contactAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={20} color={SOS_RED} />
                </TouchableOpacity>
              </View>
            </React.Fragment>
          ))}
          <TouchableOpacity style={s.addContactRow} onPress={() => setAddModal(true)} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={22} color={BLUE} />
            <Text style={s.addContactTxt}>Add Trusted Contact</Text>
          </TouchableOpacity>
        </View>


      </ScrollView>

      {/* ── Add Contact Modal ────────────────────────────────────────────────── */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.text }]}>Add Trusted Contact</Text>
            <Text style={[s.modalSub, { color: colors.subText }]}>
              This person will be alerted instantly when you press SOS.
            </Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Full name (e.g. Mummy, Raju Bhai)"
              placeholderTextColor={colors.subText}
              value={newName}
              onChangeText={setNewName}
              maxLength={40}
            />
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Mobile number (10 digits)"
              placeholderTextColor={colors.subText}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              maxLength={12}
            />
            <TouchableOpacity style={s.saveBtn} onPress={confirmAddContact} activeOpacity={0.85}>
              <Text style={s.saveBtnTxt}>Save Contact</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setAddModal(false)} activeOpacity={0.7}>
              <Text style={[s.cancelBtnTxt, { color: colors.subText }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const makeStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.sectionBg },
  scroll: { flex: 1 },

  // Header
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 16, paddingVertical: 12,
                  backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:      { padding: 6 },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: colors.text },

  // Shared card
  card:         { backgroundColor: colors.card, marginHorizontal: 16, borderRadius: 16, marginBottom: 6,
                  shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 6, elevation: 2, overflow: 'hidden' },
  cardNote:     { fontSize: 12, color: colors.subText, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, lineHeight: 18 },
  divider:      { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.subText, textTransform: 'uppercase',
                  letterSpacing: 0.8, marginHorizontal: 16, marginTop: 24, marginBottom: 8 },

  // Trusted contacts
  contactRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  contactAvatar:    { width: 42, height: 42, borderRadius: 21, backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center' },
  contactAvatarTxt: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  contactInfo:      { flex: 1 },
  contactName:      { fontSize: 14, fontWeight: '700', color: colors.text },
  contactPhone:     { fontSize: 12, color: colors.subText, marginTop: 2 },
  contactAction:    { padding: 8 },
  addContactRow:    { flexDirection: 'row', alignItems: 'center', gap: 10,
                      paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.border },
  addContactTxt:    { fontSize: 14, fontWeight: '600', color: BLUE },

  // OTP checklist
  checkRow:         { flexDirection: 'row', alignItems: 'center', gap: 12,
                      paddingHorizontal: 16, paddingVertical: 13 },
  checkLabel:       { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
  checkbox:         { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
                      alignItems: 'center', justifyContent: 'center' },
  boardingResult:   { flexDirection: 'row', alignItems: 'center', gap: 10,
                      padding: 14, borderRadius: 10, margin: 12 },
  boardingResultTxt:{ fontSize: 13, fontWeight: '700', flex: 1 },

  // Add Contact Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24,
                  paddingBottom: Platform.OS === 'ios' ? 44 : 28 },
  modalHandle:  { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  modalSub:     { fontSize: 13, marginBottom: 20, lineHeight: 18 },
  input:        { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
                  fontSize: 15, marginBottom: 12 },
  saveBtn:      { backgroundColor: SOS_RED, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
  saveBtnTxt:   { color: '#fff', fontSize: 16, fontWeight: '800' },
  cancelBtn:    { alignItems: 'center', paddingVertical: 12 },
  cancelBtnTxt: { fontSize: 15, fontWeight: '600' },

});
