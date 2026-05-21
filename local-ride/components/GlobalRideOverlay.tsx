import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useAppSettings } from '@/context/AppSettingsContext';
import { useActiveRide } from '@/context/ActiveRideContext';

const YELLOW = '#FFC82C';
const TC_KEY = 'gaon_trusted_contacts';
interface TrustedContact { id: string; name: string; phone: string }

// ── Nearby travellers helpers ─────────────────────────────────────────────────
const _NT_NAMES: [string, string][] = [
    ['Ramesh','K'],['Sunita','D'],['Mohan','S'],['Priya','Y'],
    ['Aniket','P'],['Kavita','R'],['Suresh','M'],['Geeta','T'],
    ['Deepak','B'],['Laxmi','C'],['Vinod','N'],['Sita','G'],
    ['Rajesh','V'],['Anita','J'],['Dinesh','A'],['Rekha','H'],
];
const _NT_COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#DDA0DD','#F7B731','#26de81','#a29bfe','#fd79a8','#e17055'];
function _ntHash(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h);
}
interface NearbyTraveller { id: string; firstName: string; lastInitial: string; color: string; genderLabel: 'Male'|'Female'; age: number; }
function generateNearbyTravellers(seed: string): NearbyTraveller[] {
    if (!seed) return [];
    const h = _ntHash(seed);
    const rem = h % 10;
    const count = rem < 2 ? 0 : rem < 5 ? 1 : rem < 8 ? 2 : 3;
    if (count === 0) return [];
    return Array.from({ length: count }, (_, i) => {
        const nIdx = (h + i * 13) % _NT_NAMES.length;
        const cIdx = (h + i * 7)  % _NT_COLORS.length;
        const [firstName, lastInitial] = _NT_NAMES[nIdx];
        const age = 18 + ((h + i * 17) % 48);
        return { id: `nt-${i}`, firstName, lastInitial, color: _NT_COLORS[cIdx], genderLabel: ((h + i) % 2 === 0 ? 'Male' : 'Female') as 'Male'|'Female', age };
    });
}
const GRO_CANCEL_REASONS = [
    'Driver is taking too long',
    'I need to cancel my trip',
    'Change of plans',
    'Wrong vehicle type selected',
    'Other',
];

export default function GlobalRideOverlay() {
    const { activeRide, setActiveRide, rideMinimized, setRideMinimized } = useActiveRide();
    const { colors } = useAppSettings();
    const pathname = usePathname();
    const [cancelVisible, setCancelVisible]     = useState(false);
    const [shareVisible, setShareVisible]       = useState(false);
    const [trustedContacts, setTrustedContacts] = useState<TrustedContact[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [tcChatVisible, setTcChatVisible]     = useState(false);
    const [tcChatContact, setTcChatContact]     = useState<TrustedContact | null>(null);
    const [tcChatMsg, setTcChatMsg]             = useState('');
    const [tcChatHistory, setTcChatHistory]     = useState<{ from: 'me' | 'contact'; text: string }[]>([]);

    useEffect(() => {
        if (shareVisible) {
            AsyncStorage.getItem(TC_KEY).then(raw => {
                if (raw) setTrustedContacts(JSON.parse(raw));
                else setTrustedContacts([]);
            });
        }
    }, [shareVisible]);

    const [selectedCancelReason, setSelectedCancelReason] = useState<string | null>(null);
    const [otherCancelReason, setOtherCancelReason]       = useState('');
    const nearbyTravellers = useMemo(
        () => activeRide ? generateNearbyTravellers(activeRide.id + activeRide.vehicleModel) : [],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeRide?.id, activeRide?.vehicleModel],
    );

    if (!activeRide) return null;

    const isOnBooking = !!pathname?.includes('booking');
    const otp = String(4271 + parseInt(activeRide.id.replace(/\D/g, '').slice(-3) || '0')).slice(0, 4);

    // ── Minimised floating pill — absolutely positioned, does NOT block screen touches ──
    if (rideMinimized) {
        return (
            <View style={gro.barWrapper} pointerEvents="box-none">
                <TouchableOpacity
                    style={[gro.bar, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => setRideMinimized(false)}
                    activeOpacity={0.92}
                >
                    <View style={[gro.barAvatar, { backgroundColor: activeRide.avatarColor }]}>
                        <Text style={gro.barAvatarTxt}>{activeRide.firstName[0]}{activeRide.lastName[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[gro.barName, { color: colors.text }]} numberOfLines={1}>
                            {activeRide.firstName} {activeRide.lastName}
                        </Text>
                        <Text style={[gro.barSub, { color: colors.subText }]} numberOfLines={1}>
                            {activeRide.vehicleModel} · Arriving in {activeRide.etaToPickup} min
                        </Text>
                    </View>
                    <View style={gro.barEta}>
                        <Text style={gro.barEtaNum}>{activeRide.etaToPickup}</Text>
                        <Text style={gro.barEtaLbl}>min</Text>
                    </View>
                    <Ionicons name="chevron-up" size={18} color={YELLOW} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </View>
        );
    }

    // ── When not minimised and user is on booking screen, booking.tsx handles it ──
    if (isOnBooking) return null;

    // ── Full expanded sheet (shown on all other screens) ─────────────────────────
    return (
        <>
            <Modal
                visible
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setRideMinimized(true)}
            >
                <View style={gro.overlay}>
                    <View style={[gro.sheet, { backgroundColor: colors.card }]}>

                        {/* Handle + icon-only minimize */}
                        <View style={gro.topBar}>
                            <View style={{ flex: 1 }} />
                            <View style={[gro.handle, { backgroundColor: colors.border }]} />
                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                <TouchableOpacity
                                    style={gro.minBtn}
                                    onPress={() => setRideMinimized(true)}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                >
                                    <Ionicons name="chevron-down" size={22} color={colors.subText} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Green banner */}
                        <View style={gro.banner}>
                            <View style={gro.bannerCheck}>
                                <Ionicons name="checkmark" size={24} color="#fff" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={gro.bannerTitle}>Booked! 🎉</Text>
                                <Text style={gro.bannerVehicle}>{activeRide.vehicleModel} · {activeRide.plate}</Text>
                                <Text style={gro.bannerSub}>{activeRide.vehicleColor}</Text>
                            </View>
                            <View style={gro.etaBadge}>
                                <Text style={gro.etaNum}>{activeRide.etaToPickup}</Text>
                                <Text style={gro.etaLbl}>Arriving In</Text>
                            </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

                            {/* Driver row */}
                            <View style={[gro.driverRow, { borderBottomColor: colors.border }]}>
                                <View style={[gro.avatar, { backgroundColor: activeRide.avatarColor }]}>
                                    <Text style={gro.avatarTxt}>{activeRide.firstName[0]}{activeRide.lastName[0]}</Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={[gro.driverName, { color: colors.text }]}>
                                        {activeRide.firstName} {activeRide.lastName}
                                    </Text>
                                    <Text style={[gro.driverMeta, { color: colors.subText }]}>
                                        ⭐ {activeRide.rating.toFixed(1)}  ·  {activeRide.trips.toLocaleString('en-IN')} trips  ·  {activeRide.languages.join(', ')}
                                    </Text>
                                </View>
                                <View style={gro.verBadge}>
                                    <Ionicons name="shield-checkmark" size={12} color="#2E7D32" />
                                    <Text style={gro.verTxt}>Verified</Text>
                                </View>
                            </View>

                            {/* ── Nearby Travellers card ── */}
                            {nearbyTravellers.length > 0 && (
                                <View style={[gro.ntCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                                    <View style={gro.ntHeader}>
                                        <View style={gro.ntShield}>
                                            <Ionicons name="shield-checkmark" size={16} color="#2E7D32" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[gro.ntTitle, { color: colors.text }]}>Fellow Travellers</Text>
                                            <Text style={[gro.ntSub, { color: colors.subText }]}>People from your area on this vehicle</Text>
                                        </View>
                                        <View style={gro.ntPill}>
                                            <Ionicons name="people" size={12} color="#1565C0" />
                                            <Text style={gro.ntPillTxt}> {nearbyTravellers.length} riding</Text>
                                        </View>
                                    </View>
                                    {/* Stacked avatars */}
                                    <View style={gro.ntAvatarRow}>
                                        {nearbyTravellers.map((p, idx) => (
                                            <View key={p.id} style={[gro.ntAvatar, { backgroundColor: p.color, marginLeft: idx === 0 ? 0 : -10, zIndex: 10 - idx }]}>
                                                <Text style={gro.ntAvatarTxt}>{p.firstName[0]}{p.lastInitial}</Text>
                                            </View>
                                        ))}
                                        <Text style={gro.ntAvatarSummary}>{nearbyTravellers.length} neighbour{nearbyTravellers.length > 1 ? 's' : ''} on board</Text>
                                    </View>
                                    {/* Passenger rows */}
                                    {nearbyTravellers.map(p => (
                                        <View key={p.id} style={[gro.ntRow, { borderTopColor: colors.border }]}>
                                            <View style={[gro.ntRowDot, { backgroundColor: p.color }]}>
                                                <Text style={gro.ntRowDotTxt}>{p.firstName[0]}{p.lastInitial}</Text>
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={[gro.ntRowName, { color: colors.text }]}>{p.firstName} {p.lastInitial}.</Text>
                                                <Text style={[gro.ntRowMeta, { color: colors.subText }]}>{p.genderLabel}, Age {p.age}</Text>
                                            </View>
                                            <View style={gro.ntVerified}>
                                                <Ionicons name="checkmark-circle" size={13} color="#2E7D32" />
                                                <Text style={gro.ntVerifiedTxt}>Verified</Text>
                                            </View>
                                        </View>
                                    ))}
                                    {/* Privacy notice */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6 }}>
                                        <Ionicons name="lock-closed-outline" size={10} color={colors.subText} />
                                        <Text style={{ fontSize: 10, color: colors.subText, flex: 1 }}>Full details are private · Only area shown for your safety</Text>
                                    </View>
                                </View>
                            )}

                            {/* OTP card */}
                            <View style={[gro.otpCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                                <View style={gro.otpIconWrap}>
                                    <Ionicons name="key" size={18} color="#E65100" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[gro.otpLabel, { color: colors.subText }]}>
                                        Ride OTP — share only after boarding
                                    </Text>
                                    <Text style={[gro.otpCode, { color: colors.text }]}>{otp}</Text>
                                </View>
                            </View>

                            {/* 4 action buttons — 2×2 grid */}
                            <View style={gro.actions}>
                                <TouchableOpacity
                                    style={[gro.actionBtn, { backgroundColor: '#E8F5E9' }]}
                                    onPress={() => Alert.alert('Call Driver', `Calling ${activeRide.firstName}… (Demo mode)`)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="call" size={26} color="#2E7D32" />
                                    <Text style={[gro.actionTxt, { color: '#2E7D32' }]}>Call Driver</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[gro.actionBtn, { backgroundColor: '#E3F2FD' }]}
                                    onPress={() => Alert.alert('Chat', `Open the booking screen to chat with ${activeRide.firstName}`)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="chatbubble-ellipses" size={26} color="#1565C0" />
                                    <Text style={[gro.actionTxt, { color: '#1565C0' }]}>Chat</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[gro.actionBtn, { backgroundColor: '#E8F0FE' }]}
                                    onPress={() => setShareVisible(true)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="share-social-outline" size={26} color="#3949AB" />
                                    <Text style={[gro.actionTxt, { color: '#3949AB' }]}>Share Trip</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[gro.actionBtn, { backgroundColor: '#FFEBEE' }]}
                                    onPress={() => setCancelVisible(true)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="close-circle-outline" size={26} color="#C62828" />
                                    <Text style={[gro.actionTxt, { color: '#C62828' }]}>Cancel Trip</Text>
                                </TouchableOpacity>
                            </View>

                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Cancel — 5-reason bottom sheet */}
            <Modal visible={cancelVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setCancelVisible(false)}>
                <TouchableOpacity style={gro.chatOverlay} activeOpacity={1} onPress={() => setCancelVisible(false)}>
                    <TouchableOpacity activeOpacity={1}>
                    <View style={[gro.chatSheet, { backgroundColor: colors.card }]}>
                        <View style={[gro.chatHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[gro.chatTitle, { color: colors.text }]}>Why are you cancelling?</Text>
                            <TouchableOpacity onPress={() => setCancelVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
                            {GRO_CANCEL_REASONS.map(reason => (
                                <TouchableOpacity
                                    key={reason}
                                    style={[gro.cancelReasonRow, {
                                        borderColor: selectedCancelReason === reason ? '#C62828' : colors.border,
                                        backgroundColor: selectedCancelReason === reason ? '#FFEBEE' : colors.bg,
                                    }]}
                                    onPress={() => setSelectedCancelReason(reason)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[gro.cancelReasonRadio, { borderColor: selectedCancelReason === reason ? '#C62828' : colors.border }]}>
                                        {selectedCancelReason === reason && <View style={gro.cancelReasonRadioFill} />}
                                    </View>
                                    <Text style={[gro.cancelReasonTxt, { color: colors.text, fontWeight: selectedCancelReason === reason ? '700' : '500' }]}>
                                        {reason}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                            {selectedCancelReason === 'Other' && (
                                <TextInput
                                    style={[gro.chatInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text, marginTop: 4, minHeight: 72 }]}
                                    placeholder="Tell us your reason…"
                                    placeholderTextColor={colors.subText}
                                    value={otherCancelReason}
                                    onChangeText={setOtherCancelReason}
                                    multiline
                                    textAlignVertical="top"
                                />
                            )}
                            <TouchableOpacity
                                style={[gro.cancelConfirmBtn, { opacity: selectedCancelReason ? 1 : 0.4, marginTop: 4 }]}
                                onPress={() => {
                                    if (!selectedCancelReason) return;
                                    setCancelVisible(false);
                                    setSelectedCancelReason(null);
                                    setOtherCancelReason('');
                                    setActiveRide(null);
                                }}
                                disabled={!selectedCancelReason}
                                activeOpacity={0.85}
                            >
                                <Text style={gro.cancelConfirmTxt}>Confirm Cancellation</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => setCancelVisible(false)}>
                                <Text style={{ color: colors.subText, fontSize: 14 }}>Go Back</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Share trip modal */}
            <Modal visible={shareVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setShareVisible(false)}>
                <TouchableOpacity style={gro.chatOverlay} activeOpacity={1} onPress={() => setShareVisible(false)}>
                    <TouchableOpacity activeOpacity={1}>
                    <View style={[gro.chatSheet, { backgroundColor: colors.card }]}>
                        <View style={[gro.chatHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[gro.chatTitle, { color: colors.text }]}>Share Trip</Text>
                            <TouchableOpacity onPress={() => setShareVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
                            {/* Live tracking link */}
                            <View style={[gro.shareLink, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                                <Ionicons name="link" size={16} color="#3949AB" style={{ marginRight: 8 }} />
                                <Text style={[gro.shareLinkUrl, { color: '#3949AB' }]} numberOfLines={1}>
                                    https://gaon.app/ride/{activeRide.id}
                                </Text>
                                <TouchableOpacity
                                    style={gro.shareLinkCopyBtn}
                                    onPress={() => Alert.alert('Copied!', 'Ride tracking link copied. Share it with your trusted contact.')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="copy-outline" size={13} color="#fff" />
                                    <Text style={gro.shareLinkCopyTxt}>Copy</Text>
                                </TouchableOpacity>
                            </View>
                            <Text style={{ fontSize: 11, color: colors.subText, marginTop: -4 }}>
                                Anyone with this link can track your live location and view your ride details.
                            </Text>

                            <Text style={[gro.chatTitle, { color: colors.text, fontSize: 14, marginTop: 4 }]}>Send to Trusted Contacts</Text>

                            {trustedContacts.length === 0 ? (
                                <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                                    <Ionicons name="people-outline" size={40} color={colors.subText} />
                                    <Text style={[gro.chatEmpty, { color: colors.subText, marginTop: 10 }]}>No trusted contacts saved.</Text>
                                    <Text style={[gro.chatEmpty, { color: colors.subText, fontSize: 12 }]}>Add contacts in the Safety Hub.</Text>
                                </View>
                            ) : (
                                trustedContacts.map(c => (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[gro.tcRow, {
                                            borderColor: selectedContacts.includes(c.id) ? '#1565C0' : colors.border,
                                            backgroundColor: selectedContacts.includes(c.id) ? '#E3F2FD' : colors.bg,
                                        }]}
                                        onPress={() => setSelectedContacts(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[gro.tcAvatar, { backgroundColor: YELLOW }]}>
                                            <Text style={gro.tcAvatarTxt}>{c.name.charAt(0).toUpperCase()}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[gro.tcName, { color: colors.text }]}>{c.name}</Text>
                                            <Text style={{ fontSize: 12, color: colors.subText }}>{c.phone}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[gro.tcRoundBtn, { backgroundColor: '#E8F5E9' }]}
                                            onPress={() => Alert.alert('Call', `Calling ${c.name} at ${c.phone}… (Demo)`)}
                                            activeOpacity={0.8}
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                        >
                                            <Ionicons name="call" size={14} color="#2E7D32" />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[gro.tcRoundBtn, { backgroundColor: '#E3F2FD', marginLeft: 6 }]}
                                            onPress={() => { setShareVisible(false); setTcChatContact(c); setTcChatHistory([]); setTcChatVisible(true); }}
                                            activeOpacity={0.8}
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                        >
                                            <Ionicons name="chatbubble-ellipses" size={14} color="#1565C0" />
                                        </TouchableOpacity>
                                        <View style={[gro.tcCheck, {
                                            backgroundColor: selectedContacts.includes(c.id) ? '#1565C0' : 'transparent',
                                            borderColor: selectedContacts.includes(c.id) ? '#1565C0' : colors.border,
                                            marginLeft: 6,
                                        }]}>
                                            {selectedContacts.includes(c.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                        </View>
                                    </TouchableOpacity>
                                ))
                            )}

                            {trustedContacts.length > 0 && (
                                <TouchableOpacity
                                    style={[gro.confirmShareBtn, { backgroundColor: '#1565C0', opacity: selectedContacts.length > 0 ? 1 : 0.4 }]}
                                    onPress={() => {
                                        const names = trustedContacts.filter(c => selectedContacts.includes(c.id)).map(c => c.name).join(', ');
                                        setShareVisible(false);
                                        setSelectedContacts([]);
                                        Alert.alert('Trip Shared! 🔗', `Live ride link sent to: ${names}\n\nhttps://gaon.app/ride/${activeRide.id}`);
                                    }}
                                    disabled={selectedContacts.length === 0}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="share-social" size={18} color="#fff" />
                                    <Text style={[gro.confirmShareTxt]}>Share with {selectedContacts.length > 0 ? `${selectedContacts.length} contact${selectedContacts.length > 1 ? 's' : ''}` : 'contacts'}</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Trusted contact chat */}
            <Modal visible={tcChatVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setTcChatVisible(false)}>
                <TouchableOpacity style={gro.chatOverlay} activeOpacity={1} onPress={() => setTcChatVisible(false)}>
                    <TouchableOpacity activeOpacity={1}>
                    <View style={[gro.chatSheet, { backgroundColor: colors.card }]}>
                        <View style={[gro.chatHeader, { borderBottomColor: colors.border }]}>
                            <View style={{ flex: 1 }}>
                                <Text style={[gro.chatTitle, { color: colors.text }]}>{tcChatContact?.name ?? 'Contact'}</Text>
                                <Text style={{ fontSize: 12, color: colors.subText }}>{tcChatContact?.phone}</Text>
                            </View>
                            <TouchableOpacity
                                style={[gro.tcRoundBtn, { backgroundColor: '#E8F5E9', marginRight: 8 }]}
                                onPress={() => Alert.alert('Call', `Calling ${tcChatContact?.name} at ${tcChatContact?.phone}… (Demo)`)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="call" size={16} color="#2E7D32" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setTcChatVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={gro.chatHistory} contentContainerStyle={{ paddingVertical: 12, gap: 8 }}>
                            {tcChatHistory.length === 0 && (
                                <Text style={[gro.chatEmpty, { color: colors.subText }]}>
                                    Share your ride link with {tcChatContact?.name}. Their replies appear here.
                                </Text>
                            )}
                            {tcChatHistory.map((msg, i) => (
                                <View key={i} style={[gro.chatBubbleWrap, msg.from === 'me' && { alignItems: 'flex-end' }]}>
                                    <View style={[gro.chatBubble, msg.from === 'me'
                                        ? { backgroundColor: YELLOW }
                                        : { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }
                                    ]}>
                                        <Text style={[gro.chatBubbleTxt, { color: msg.from === 'me' ? '#1A1A1A' : colors.text }]}>
                                            {msg.text}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={[gro.chatInputRow, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                            <TextInput
                                style={[gro.chatInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                                placeholder="Type a message…"
                                placeholderTextColor={colors.subText ?? '#999'}
                                value={tcChatMsg}
                                onChangeText={setTcChatMsg}
                                returnKeyType="send"
                                onSubmitEditing={() => {
                                    if (!tcChatMsg.trim()) return;
                                    const txt = tcChatMsg.trim();
                                    setTcChatHistory(prev => [...prev, { from: 'me', text: txt }]);
                                    setTcChatMsg('');
                                    setTimeout(() => setTcChatHistory(prev => [...prev, { from: 'contact', text: 'Got it! I can see your location 📍' }]), 1500);
                                }}
                                multiline
                            />
                            <TouchableOpacity
                                style={[gro.chatSendBtn, { backgroundColor: YELLOW, opacity: tcChatMsg.trim() ? 1 : 0.4 }]}
                                onPress={() => {
                                    if (!tcChatMsg.trim()) return;
                                    const txt = tcChatMsg.trim();
                                    setTcChatHistory(prev => [...prev, { from: 'me', text: txt }]);
                                    setTcChatMsg('');
                                    setTimeout(() => setTcChatHistory(prev => [...prev, { from: 'contact', text: 'Got it! I can see your location 📍' }]), 1500);
                                }}
                                disabled={!tcChatMsg.trim()}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="send" size={18} color="#1A1A1A" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const gro = StyleSheet.create({
    // ── Minimised bar ──────────────────────────────────────────────────────────
    // Absolutely positioned — does NOT use Modal so touches pass through freely
    barWrapper:     { position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 999 },
    bar:            { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 22, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.14, shadowOffset: { width: 0, height: 4 }, shadowRadius: 14, elevation: 10 },
    barAvatar:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    barAvatarTxt:   { fontSize: 15, fontWeight: '800', color: '#fff' },
    barName:        { fontSize: 14, fontWeight: '700', marginBottom: 1 },
    barSub:         { fontSize: 12 },
    barEta:         { alignItems: 'center', backgroundColor: YELLOW, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
    barEtaNum:      { fontSize: 16, fontWeight: '900', color: '#1A1A1A' },
    barEtaLbl:      { fontSize: 10, fontWeight: '700', color: '#1A1A1A', marginTop: -2 },
    // ── Full sheet ─────────────────────────────────────────────────────────────
    overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet:          { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '92%' },
    topBar:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
    handle:         { width: 40, height: 4, borderRadius: 2 },
    minBtn:         { padding: 8, borderRadius: 20 },
    // Banner
    banner:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2E7D32', paddingHorizontal: 20, paddingVertical: 16 },
    bannerCheck:    { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    bannerTitle:    { fontSize: 17, fontWeight: '900', color: '#fff' },
    bannerSub:      { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    bannerVehicle:  { fontSize: 15, fontWeight: '900', color: '#fff', marginTop: 2 },
    etaBadge:       { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
    etaNum:         { fontSize: 24, fontWeight: '900', color: '#fff' },
    etaLbl:         { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: -1 },
    // Driver
    driverRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 12, paddingBottom: 14, borderBottomWidth: 1 },
    avatar:         { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:      { fontSize: 20, fontWeight: '900', color: '#fff' },
    driverName:     { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    driverMeta:     { fontSize: 12, marginTop: 2 },
    verBadge:       { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    verTxt:         { fontSize: 10, fontWeight: '700', color: '#2E7D32' },
    // OTP
    otpCard:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 14, borderRadius: 16, borderWidth: 1, padding: 16 },
    otpIconWrap:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center' },
    otpLabel:       { fontSize: 11, fontWeight: '500', marginBottom: 3 },
    otpCode:        { fontSize: 30, fontWeight: '900', letterSpacing: 10 },
    // Actions — 2×2 grid
    actions:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16, marginBottom: 8 },
    actionBtn:      { width: '47.5%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20, borderRadius: 16 },
    actionTxt:      { fontSize: 14, fontWeight: '700' },
    // Cancel confirmation
    cancelOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    cancelBox:      { width: '100%', borderRadius: 20, padding: 24 },
    cancelTitle:    { fontSize: 20, fontWeight: '800', marginBottom: 8 },
    cancelSub:      { fontSize: 14, marginBottom: 20, lineHeight: 20 },
    cancelConfirmBtn: { backgroundColor: '#C62828', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 },
    cancelConfirmTxt: { fontSize: 15, fontWeight: '800', color: '#fff' },
    cancelKeepBtn:  { borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    cancelKeepTxt:  { fontSize: 15, fontWeight: '600' },
    // Cancel reasons
    cancelReasonRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1.5, borderRadius: 14 },
    cancelReasonRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    cancelReasonRadioFill: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C62828' },
    cancelReasonTxt:   { flex: 1, fontSize: 14 },
    // Nearby travellers card
    ntCard:          { marginHorizontal: 16, marginBottom: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
    ntHeader:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    ntShield:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
    ntTitle:         { fontSize: 13, fontWeight: '800' },
    ntSub:           { fontSize: 11, marginTop: 1 },
    ntPill:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    ntPillTxt:       { fontSize: 11, fontWeight: '700', color: '#1565C0' },
    ntAvatarRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    ntAvatar:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    ntAvatarTxt:     { fontSize: 11, fontWeight: '800', color: '#fff' },
    ntAvatarSummary: { fontSize: 12, fontWeight: '600', marginLeft: 14 },
    ntRow:           { flexDirection: 'row', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 1 },
    ntRowDot:        { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    ntRowDotTxt:     { fontSize: 11, fontWeight: '800', color: '#fff' },
    ntRowName:       { fontSize: 13, fontWeight: '700' },
    ntRowMeta:       { fontSize: 11, marginTop: 2 },
    ntVerified:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
    ntVerifiedTxt:   { fontSize: 10, fontWeight: '700', color: '#2E7D32' },
    // Share + TC chat
    shareLink:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12 },
    shareLinkUrl:   { flex: 1, fontSize: 12, fontWeight: '600' },
    shareLinkCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3949AB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
    shareLinkCopyTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },
    tcRow:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderWidth: 1.5, borderRadius: 14 },
    tcAvatar:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: YELLOW },
    tcAvatarTxt:    { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
    tcName:         { fontSize: 14, fontWeight: '600' },
    tcCheck:        { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    tcRoundBtn:     { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    confirmShareBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15, marginTop: 8 },
    confirmShareTxt:{ fontSize: 15, fontWeight: '800', color: '#fff' },
    chatOverlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
    chatSheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' },
    chatHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    chatTitle:      { fontSize: 17, fontWeight: '800' },
    chatHistory:    { maxHeight: 220, paddingHorizontal: 16 },
    chatEmpty:      { textAlign: 'center', fontSize: 14, paddingVertical: 8 },
    chatBubbleWrap: { marginBottom: 6 },
    chatBubble:     { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
    chatBubbleTxt:  { fontSize: 14 },
    chatInputRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1 },
    chatInput:      { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
    chatSendBtn:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
