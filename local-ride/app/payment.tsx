import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppSettings } from '@/context/AppSettingsContext';
import { t } from '@/translations';

const YELLOW = '#FFD700';
const GREEN = '#4CAF50';
const BLUE = '#2196F3';
const PURPLE = '#9C27B0';
const ACCENT = '#FFC300';

const INDIAN_BANKS = [
  'State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank',
  'Punjab National Bank', 'Bank of Baroda', 'Bank of India', 'Canara Bank', 'Union Bank of India',
  'IndusInd Bank', 'Yes Bank', 'IDBI Bank', 'Indian Bank', 'Central Bank of India',
  'Bank of Maharashtra', 'Federal Bank', 'Indian Overseas Bank', 'UCO Bank', 'Punjab & Sind Bank',
  'IDFC FIRST Bank', 'Bandhan Bank', 'South Indian Bank', 'City Union Bank', 'Karur Vysya Bank',
  'RBL Bank', 'Jammu & Kashmir Bank', 'Karnataka Bank', 'Dhanlaxmi Bank', 'Tamilnad Mercantile Bank'
];

export default function PaymentScreen() {
  const router = useRouter();
  const { colors, isDark, language } = useAppSettings();
  const s = makeStyles(colors);
  const lang = language.code;

  const [addMoneyModal, setAddMoneyModal] = useState(false);
  const [addCardModal, setAddCardModal] = useState(false);
  const [addMoneyAmount, setAddMoneyAmount] = useState('');
  const [walletBalance, setWalletBalance] = useState(150.00);

  const [addMoneyStep, setAddMoneyStep] = useState<'SELECT' | 'UPI' | 'NETBANKING' | 'CARD' | 'PROCESSING'>('SELECT');

  const [cardNumber, setCardNumber]     = useState('');
  const [cardExpiry, setCardExpiry]     = useState('');
  const [cardCvv, setCardCvv]           = useState('');

  const [cards, setCards] = useState([
    { id: '1', number: '4242', bank: 'HDFC Bank' }
  ]);

  const [detailModal, setDetailModal] = useState<{ visible: boolean; title: string; content: string; type?: 'QR' | 'HISTORY' | 'INFO' }>({
    visible: false,
    title: '',
    content: '',
  });

  const processPayment = (method: string) => {
    setAddMoneyStep('PROCESSING');
    setTimeout(() => {
      setWalletBalance(prev => prev + Number(addMoneyAmount));
      setAddMoneyModal(false);
      Alert.alert('Payment Successful', `₹${addMoneyAmount} added to your wallet via ${method}.`);
    }, 2000);
  };

  const handleMethodSelect = (method: 'CARD' | 'UPI' | 'NETBANKING') => {
    if (!addMoneyAmount || isNaN(Number(addMoneyAmount)) || Number(addMoneyAmount) <= 0) {
      Alert.alert('Amount Missing', 'Please enter a valid amount.');
      return;
    }
    setAddMoneyStep(method);
  };

  const handleAddCard = () => {
    if (!cardNumber || cardNumber.length < 16 || !cardExpiry || !cardCvv) {
      Alert.alert('Invalid Details', 'Please enter a valid 16-digit card number and other details.');
      return;
    }
    const newCard = {
      id: Date.now().toString(),
      number: cardNumber.slice(-4),
      bank: 'Linked Bank'
    };
    setCards([...cards, newCard]);
    setAddCardModal(false);
    setCardNumber(''); setCardExpiry(''); setCardCvv('');
    Alert.alert('Success', 'Card added successfully.');
  };

  const showDetail = (title: string, content: string, type: 'QR' | 'HISTORY' | 'INFO' = 'INFO') => {
    setDetailModal({ visible: true, title, content, type });
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('payment_methods', lang)}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        
        {/* WALLET SECTION */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>{t('wallet', lang)}</Text></View>
        <View style={[s.card, { paddingVertical: 20 }]}>
          <View style={s.walletRow}>
            <View>
              <Text style={s.walletLabel}>{t('wallet_balance', lang)}</Text>
              <Text style={s.walletAmount}>₹{walletBalance.toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={s.addMoneyBtn} onPress={() => {
              setAddMoneyStep('SELECT');
              setAddMoneyAmount('');
              setAddMoneyModal(true);
            }} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={20} color="#1A1A1A" />
              <Text style={s.addMoneyText}>{t('add_money', lang)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* UPI SECTION */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>{t('upi', lang)}</Text></View>
        <View style={s.card}>
          <PaymentRow icon="google" lib="mci" label={t('gpay', lang)} color={BLUE} s={s} colors={colors} />
          <View style={s.divider} />
          <PaymentRow icon="alpha-p-circle" lib="mci" label={t('phonepe', lang)} color={PURPLE} s={s} colors={colors} />
          <View style={s.divider} />
          <PaymentRow icon="alpha-p-box" lib="mci" label={t('paytm', lang)} color={'#00B9F5'} s={s} colors={colors} />
        </View>

        {/* CARDS SECTION */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>{t('cards', lang)}</Text></View>
        <View style={s.card}>
          {cards.map((card, idx) => (
            <View key={card.id}>
              <PaymentRow 
                icon="card-outline" lib="ion" label={`•••• •••• •••• ${card.number}`} color={colors.text} subtitle={card.bank} 
                onRemove={() => {
                  Alert.alert('Remove Card', `Remove card ending in ${card.number}?`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => setCards(cards.filter(c => c.id !== card.id)) }
                  ]);
                }}
                s={s} colors={colors} 
              />
              {idx < cards.length - 1 && <View style={s.divider} />}
            </View>
          ))}
          <TouchableOpacity style={s.addCardRow} onPress={() => setAddCardModal(true)} activeOpacity={0.7}>
            <Ionicons name="add" size={24} color={BLUE} />
            <Text style={s.addCardText}>{t('add_card', lang)}</Text>
          </TouchableOpacity>
        </View>

        {/* OTHER METHODS */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>Other</Text></View>
        <View style={s.card}>
          <PaymentRow icon="qr-code-outline" lib="ion" label={t('qr_pay', lang)} color={colors.text} s={s} colors={colors} 
             onPress={() => showDetail(t('qr_pay', lang), 'Scan for easy payments', 'QR')} />
          <View style={s.divider} />
          <PaymentRow icon="cash-outline" lib="ion" label={t('cash', lang)} color={GREEN} s={s} colors={colors} 
             onPress={() => showDetail(t('cash', lang), 'Cash payment is active as fallback.', 'INFO')} />
        </View>

        {/* TRANSACTION HISTORY */}
        <View style={s.sectionHeader}><Text style={s.sectionTitle}>{t('transaction_history', lang)}</Text></View>
        <View style={s.card}>
          <PaymentRow icon="card-outline" lib="ion" label={t('paid', lang)} color={colors.text} s={s} colors={colors} 
             onPress={() => showDetail(t('paid', lang), 'Recent payments list', 'HISTORY')} />
          <View style={s.divider} />
          <PaymentRow icon="refresh-outline" lib="ion" label={t('refund', lang)} color={BLUE} s={s} colors={colors} 
             onPress={() => showDetail(t('refund', lang), 'Recent refunds list', 'HISTORY')} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ADD MONEY MODAL */}
      <Modal visible={addMoneyModal} transparent animationType="slide" onRequestClose={() => setAddMoneyModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setAddMoneyModal(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            
            {addMoneyStep !== 'SELECT' && addMoneyStep !== 'PROCESSING' && (
              <TouchableOpacity onPress={() => setAddMoneyStep('SELECT')} style={{ position: 'absolute', top: 24, left: 20, padding: 4 }}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
            )}

            <Text style={[s.modalTitle, (addMoneyStep !== 'SELECT' && addMoneyStep !== 'PROCESSING') && { textAlign: 'center' }]}>
              {addMoneyStep === 'PROCESSING' ? 'Processing Transaction' : t('add_money', lang)}
            </Text>

            {addMoneyStep === 'SELECT' && (
              <>
                <Text style={s.modalSub}>Enter amount to add to your wallet</Text>
                <TextInput
                  style={s.amountInput} placeholder="₹0" placeholderTextColor={colors.subText}
                  keyboardType="number-pad" value={addMoneyAmount} onChangeText={setAddMoneyAmount} autoFocus
                />
                <Text style={[s.modalSub, { marginTop: 16, marginBottom: 8 }]}>Select Payment Method</Text>
                <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                  <MethodOption icon="card-outline" label={t('credit_debit_card', lang)} onPress={() => handleMethodSelect('CARD')} s={s} colors={colors} />
                  <MethodOption icon="phone-portrait-outline" label={t('upi', lang)} onPress={() => handleMethodSelect('UPI')} s={s} colors={colors} />
                  <MethodOption icon="business-outline" label={t('internet_banking', lang)} onPress={() => handleMethodSelect('NETBANKING')} s={s} colors={colors} />
                </ScrollView>
              </>
            )}

            {addMoneyStep === 'UPI' && (
              <View style={{ marginTop: 20 }}>
                <Text style={[s.modalSub, { marginBottom: 12 }]}>Choose UPI App to pay ₹{addMoneyAmount}</Text>
                <ScrollView style={{ maxHeight: 250 }}>
                  <MethodOption icon="logo-google" label="Google Pay" onPress={() => processPayment('Google Pay')} s={s} colors={colors} />
                  <MethodOption icon="chatbubble-ellipses-outline" label="PhonePe" onPress={() => processPayment('PhonePe')} s={s} colors={colors} />
                  <MethodOption icon="wallet-outline" label="Paytm" onPress={() => processPayment('Paytm')} s={s} colors={colors} />
                </ScrollView>
              </View>
            )}

            {addMoneyStep === 'NETBANKING' && (
              <View style={{ marginTop: 20 }}>
                <Text style={[s.modalSub, { marginBottom: 12 }]}>Select Bank to pay ₹{addMoneyAmount}</Text>
                <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
                  {INDIAN_BANKS.map((bank, index) => (
                    <MethodOption 
                      key={index} 
                      icon="business" 
                      label={bank} 
                      onPress={() => processPayment(`${bank} Netbanking`)} 
                      s={s} colors={colors} 
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {addMoneyStep === 'CARD' && (
              <View style={{ marginTop: 20 }}>
                <Text style={[s.modalSub, { marginBottom: 16 }]}>Pay ₹{addMoneyAmount} via Card</Text>
                <TextInput style={s.input} placeholder="Card Number" placeholderTextColor={colors.subText} keyboardType="number-pad" value={cardNumber} onChangeText={setCardNumber} />
                <View style={s.rowInputs}>
                  <TextInput style={[s.input, { flex: 1, marginRight: 8 }]} placeholder="MM/YY" placeholderTextColor={colors.subText} value={cardExpiry} onChangeText={setCardExpiry} />
                  <TextInput style={[s.input, { flex: 1, marginLeft: 8 }]} placeholder="CVV" placeholderTextColor={colors.subText} keyboardType="number-pad" secureTextEntry value={cardCvv} onChangeText={setCardCvv} />
                </View>
                <TouchableOpacity style={[s.btn, { backgroundColor: YELLOW, marginTop: 12 }]} onPress={() => {
                  if (!cardNumber || !cardExpiry || !cardCvv) Alert.alert('Details Missing', 'Please fill all card details.');
                  else processPayment('Card ending in ' + cardNumber.slice(-4));
                }}>
                  <Text style={[s.btnText, { color: '#1A1A1A', textAlign: 'center' }]}>Pay ₹{addMoneyAmount}</Text>
                </TouchableOpacity>
              </View>
            )}

            {addMoneyStep === 'PROCESSING' && (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color={YELLOW} />
                <Text style={[s.modalSub, { marginTop: 16 }]}>Redirecting to secure gateway...</Text>
                <Text style={[s.modalSub, { marginTop: 8, fontSize: 12 }]}>Please do not close or press back</Text>
              </View>
            )}

          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ADD CARD MODAL */}
      <Modal visible={addCardModal} transparent animationType="fade" onRequestClose={() => setAddCardModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={s.modalCenterOverlay}>
            <View style={s.modalCenterCard}>
              <Text style={s.modalTitle}>{t('add_card', lang)}</Text>
              <Text style={[s.modalSub, { marginBottom: 16 }]}>{t('credit_debit_card', lang)}</Text>
              
              <TextInput style={s.input} placeholder="Card Number" placeholderTextColor={colors.subText} keyboardType="number-pad" value={cardNumber} onChangeText={setCardNumber} />
              <View style={s.rowInputs}>
                <TextInput style={[s.input, { flex: 1, marginRight: 8 }]} placeholder="MM/YY" placeholderTextColor={colors.subText} value={cardExpiry} onChangeText={setCardExpiry} />
                <TextInput style={[s.input, { flex: 1, marginLeft: 8 }]} placeholder="CVV" placeholderTextColor={colors.subText} keyboardType="number-pad" secureTextEntry value={cardCvv} onChangeText={setCardCvv} />
              </View>

              <View style={s.modalActions}>
                <TouchableOpacity style={[s.btn, { backgroundColor: colors.border }]} onPress={() => setAddCardModal(false)}>
                  <Text style={[s.btnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: YELLOW }]} onPress={handleAddCard}>
                  <Text style={[s.btnText, { color: '#1A1A1A' }]}>Save Card</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DETAIL MODAL (Working Mock) */}
      <Modal visible={detailModal.visible} transparent animationType="slide" onRequestClose={() => setDetailModal({ ...detailModal, visible: false })}>
        <TouchableOpacity style={s.modalBackdrop} activeOpacity={1} onPress={() => setDetailModal({ ...detailModal, visible: false })}>
          <View style={[s.modalSheet, { minHeight: 300 }]}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{detailModal.title}</Text>
            <Text style={s.modalSub}>{detailModal.content}</Text>

            <View style={{ marginTop: 24, alignItems: 'center' }}>
              {detailModal.type === 'QR' && (
                <View style={{ padding: 20, backgroundColor: '#FFF', borderRadius: 12 }}>
                  <Ionicons name="qr-code" size={180} color="#000" />
                </View>
              )}
              {detailModal.type === 'HISTORY' && (
                <View style={{ width: '100%', gap: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: colors.inputBg, borderRadius: 8 }}>
                    <Text style={{ color: colors.text }}>Ride to City Center</Text>
                    <Text style={{ fontWeight: 'bold', color: colors.text }}>₹240</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: colors.inputBg, borderRadius: 8 }}>
                    <Text style={{ color: colors.text }}>Wallet Top-up</Text>
                    <Text style={{ fontWeight: 'bold', color: GREEN }}>+₹500</Text>
                  </View>
                </View>
              )}
              {detailModal.type === 'INFO' && (
                <View style={{ width: '100%', padding: 20, backgroundColor: colors.inputBg, borderRadius: 12, alignItems: 'center' }}>
                  <Ionicons name="information-circle-outline" size={48} color={BLUE} />
                  <Text style={{ color: colors.text, marginTop: 12, textAlign: 'center' }}>This feature is currently simulated for demonstration.</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={[s.btn, { backgroundColor: YELLOW, marginTop: 32 }]} onPress={() => setDetailModal({ ...detailModal, visible: false })}>
              <Text style={[s.btnText, { color: '#000', textAlign: 'center' }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

function PaymentRow({ icon, lib, label, color, subtitle, onPress, onRemove, s, colors }: any) {
  return (
    <TouchableOpacity style={s.paymentRow} activeOpacity={onPress ? 0.7 : 1} onPress={onPress}>
      <View style={[s.iconWrapper, { backgroundColor: colors.iconBg }]}>
        {lib === 'mci' 
          ? <MaterialCommunityIcons name={icon as any} size={24} color={color} />
          : <Ionicons name={icon as any} size={24} color={color} />}
      </View>
      <View style={s.rowTextWrap}>
        <Text style={s.rowLabel}>{label}</Text>
        {!!subtitle && <Text style={s.rowSubtitle}>{subtitle}</Text>}
      </View>
      {onRemove ? (
        <TouchableOpacity onPress={onRemove} style={{ padding: 6 }}>
          <Text style={{ color: '#FF4444', fontSize: 13, fontWeight: '600' }}>Remove</Text>
        </TouchableOpacity>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.subText} />
      )}
    </TouchableOpacity>
  );
}

function MethodOption({ icon, label, onPress, s, colors }: any) {
  return (
    <TouchableOpacity style={s.methodOption} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.text} style={{ marginRight: 12 }} />
      <Text style={s.methodLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.subText} />
    </TouchableOpacity>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.sectionBg },
  container: { flex: 1, backgroundColor: colors.sectionBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.subText, textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { backgroundColor: colors.card, borderRadius: 16, marginHorizontal: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  walletLabel: { fontSize: 14, color: colors.subText, marginBottom: 4 },
  walletAmount: { fontSize: 28, fontWeight: 'bold', color: colors.text },
  addMoneyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: YELLOW, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  addMoneyText: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginLeft: 6 },
  
  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  iconWrapper: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.subText, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 74 },
  
  addCardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  addCardText: { fontSize: 15, fontWeight: '600', color: BLUE, marginLeft: 12 },
  
  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  modalHandle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
  modalSub: { fontSize: 14, color: colors.subText },
  
  amountInput: { fontSize: 32, fontWeight: 'bold', color: colors.text, borderBottomWidth: 2, borderBottomColor: YELLOW, paddingVertical: 12, marginTop: 12, textAlign: 'center' },
  methodOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  methodLabel: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' },
  
  modalCenterOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCenterCard: { width: '100%', backgroundColor: colors.card, borderRadius: 16, padding: 20 },
  input: { backgroundColor: colors.inputBg, color: colors.text, fontSize: 16, padding: 14, borderRadius: 12, marginBottom: 12 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 12 },
  btn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  btnText: { fontSize: 15, fontWeight: 'bold' },
});
