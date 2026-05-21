import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  TextInput, Image, Alert, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppSettings } from '@/context/AppSettingsContext';
import { t } from '@/translations';

const YELLOW = '#FFD700';
const ACCENT = '#FFC300';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { colors, isDark, language, profile, setProfile } = useAppSettings();
  const lang = language.code;
  const s = makeStyles(colors);

  const [profileImage, setProfileImage] = useState<string | null>(profile.profileImage);
  const [name,  setName]  = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);

  const [editingName,  setEditingName]  = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [tempName,  setTempName]  = useState(name);
  const [tempPhone, setTempPhone] = useState(phone);
  const [tempEmail, setTempEmail] = useState(email);

  const saveField = (field: 'name' | 'phone' | 'email') => {
    if (field === 'name')  { setName(tempName);   setEditingName(false);  setProfile({ ...profile, name: tempName, profileImage }); }
    if (field === 'phone') { setPhone(tempPhone);  setEditingPhone(false); setProfile({ ...profile, phone: tempPhone, profileImage }); }
    if (field === 'email') { setEmail(tempEmail);  setEditingEmail(false); setProfile({ ...profile, email: tempEmail, profileImage }); }
  };
  const cancelField = (field: 'name' | 'phone' | 'email') => {
    if (field === 'name')  { setTempName(name);   setEditingName(false); }
    if (field === 'phone') { setTempPhone(phone);  setEditingPhone(false); }
    if (field === 'email') { setTempEmail(email);  setEditingEmail(false); }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to update your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setProfileImage(uri);
      setProfile({ ...profile, name, phone, email, profileImage: uri });
    }
  };

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('personal_info', lang)}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        {/* Profile Photo */}
        <View style={s.photoSection}>
          <View style={s.avatarWrapper}>
            {profileImage
              ? <Image source={{ uri: profileImage }} style={s.avatarImage} />
              : <View style={s.avatarPlaceholder}><Text style={s.avatarInitials}>{initials}</Text></View>
            }
            <TouchableOpacity style={s.cameraBadge} onPress={pickImage} activeOpacity={0.8}>
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
            <Text style={s.addPhotoText}>
              {profileImage ? t('change_photo', lang) : t('add_photo', lang)}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={s.card}>
          <InfoRow icon="person-outline" label={t('full_name', lang)} value={name}
            editing={editingName} tempValue={tempName} onTempChange={setTempName}
            onEdit={() => { setTempName(name); setEditingName(true); }}
            onSave={() => saveField('name')} onCancel={() => cancelField('name')}
            keyboardType="default" s={s} colors={colors} lang={lang}
          />
          <View style={s.divider} />
          <InfoRow icon="call-outline" label={t('contact_number', lang)} value={phone}
            editing={editingPhone} tempValue={tempPhone} onTempChange={setTempPhone}
            onEdit={() => { setTempPhone(phone); setEditingPhone(true); }}
            onSave={() => saveField('phone')} onCancel={() => cancelField('phone')}
            keyboardType="phone-pad" s={s} colors={colors} lang={lang}
          />
          <View style={s.divider} />
          <InfoRow icon="mail-outline" label={t('email_address', lang)} value={email}
            editing={editingEmail} tempValue={tempEmail} onTempChange={setTempEmail}
            onEdit={() => { setTempEmail(email); setEditingEmail(true); }}
            onSave={() => saveField('email')} onCancel={() => cancelField('email')}
            keyboardType="email-address" s={s} colors={colors} lang={lang}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value, editing, tempValue, onTempChange, onEdit, onSave, onCancel, keyboardType, s, colors, lang }: {
  icon: string; label: string; value: string; editing: boolean; tempValue: string;
  onTempChange: (v: string) => void; onEdit: () => void; onSave: () => void;
  onCancel: () => void; keyboardType?: any; s: any; colors: any; lang: string;
}) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoLeft}>
        <Ionicons name={icon as any} size={20} color={ACCENT} style={s.infoIcon} />
        <View style={s.infoTextBlock}>
          <Text style={s.infoLabel}>{label}</Text>
          {editing
            ? <TextInput style={s.infoInput} value={tempValue} onChangeText={onTempChange}
                keyboardType={keyboardType} autoFocus autoCapitalize="words"
                returnKeyType="done" onSubmitEditing={onSave} />
            : <Text style={s.infoValue}>{value}</Text>
          }
        </View>
      </View>
      <View style={s.infoRight}>
        {editing ? (
          <View style={s.actionButtons}>
            <TouchableOpacity style={s.saveBtn} onPress={onSave} activeOpacity={0.8}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={s.saveBtnText}>{t('save', lang)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={s.cancelBtnText}>{t('cancel', lang)}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.editBtn} onPress={onEdit} activeOpacity={0.8}>
            <Ionicons name="pencil-outline" size={14} color={colors.text} />
            <Text style={s.editBtnText}>{t('edit', lang)}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe:            { flex: 1, backgroundColor: colors.bg },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:         { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.inputBg, justifyContent: 'center', alignItems: 'center' },
  headerTitle:     { fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: 0.3 },
  container:       { flex: 1, backgroundColor: colors.bg },
  photoSection:    { alignItems: 'center', paddingVertical: 32, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarWrapper:   { position: 'relative', marginBottom: 12 },
  avatarImage:     { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: YELLOW },
  avatarPlaceholder:{ width: 100, height: 100, borderRadius: 50, backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: ACCENT },
  avatarInitials:  { fontSize: 36, fontWeight: 'bold', color: '#1A1A1A' },
  cameraBadge:     { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.card },
  addPhotoText:    { fontSize: 14, fontWeight: '600', color: ACCENT, letterSpacing: 0.2 },
  card:            { backgroundColor: colors.card, marginTop: 16, borderRadius: 16, marginHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3, overflow: 'hidden' },
  divider:         { height: 1, backgroundColor: colors.border, marginLeft: 56 },
  infoRow:         { flexDirection: 'row', alignItems: 'flex-start', padding: 16, minHeight: 72 },
  infoLeft:        { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  infoIcon:        { marginTop: 2, marginRight: 12 },
  infoTextBlock:   { flex: 1 },
  infoLabel:       { fontSize: 12, color: colors.subText, fontWeight: '500', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue:       { fontSize: 15, color: colors.text, fontWeight: '500' },
  infoInput:       { fontSize: 15, color: colors.text, fontWeight: '500', borderBottomWidth: 1.5, borderBottomColor: ACCENT, paddingVertical: 2 },
  infoRight:       { marginLeft: 8, alignItems: 'flex-end', justifyContent: 'center', paddingTop: 16 },
  editBtn:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, gap: 4 },
  editBtnText:     { fontSize: 13, color: colors.text, fontWeight: '600' },
  actionButtons:   { alignItems: 'flex-end', gap: 6 },
  saveBtn:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1A1A1A', gap: 4 },
  saveBtnText:     { fontSize: 13, color: '#fff', fontWeight: '600' },
  cancelBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  cancelBtnText:   { fontSize: 13, color: colors.subText, fontWeight: '500' },
});
