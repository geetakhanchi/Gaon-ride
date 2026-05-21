import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, TextInput,
    ScrollView, ActivityIndicator, Alert, Platform, StatusBar,
    Dimensions, Modal, FlatList, Keyboard, Linking, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useNotifications } from '@/context/NotificationContext';
import { useActiveRide } from '@/context/ActiveRideContext';
import { t } from '@/translations';
import { bookRide, createPaymentOrder, verifyPayment, updateRidePayment } from '@/services/api';
import {
    fetchPlacePredictions,
    fetchPlaceDetails,
    fetchDirections,
    fetchDistanceMatrix,
    decodePolyline,
    calculateDynamicFare,
    reverseGeocode,
    INDIA_FALLBACK,
    PlacePrediction,
    PlaceDetail,
    DirectionsResult,
} from '@/services/googleMaps';

const YELLOW = '#FFC82C';
const { width: SCREEN_W } = Dimensions.get('window');

const RIDE_META: Record<string, { icon: string; lib: string; color: string; fare: string; eta: string; key: string; baseFare: number; perKm: number }> = {
    '1': { icon: 'motorbike',    lib: 'mci', color: '#BF360C', fare: '₹35–55',  eta: '3 min',  key: 'bike',        baseFare: 20, perKm: 10 },
    '2': { icon: 'rickshaw',     lib: 'mci', color: '#2E7D32', fare: '₹60–90',  eta: '5 min',  key: 'auto',        baseFare: 30, perKm: 13 },
    '3': { icon: 'car-hatchback',lib: 'mci', color: '#1565C0', fare: '₹120–160',eta: '7 min',  key: 'private_car', baseFare: 50, perKm: 18 },
    '4': { icon: 'moped',       lib: 'mci', color: '#6A1B9A', fare: '₹30–45',  eta: '4 min',  key: 'bike_taxi',   baseFare: 15, perKm: 9  },
    '5': { icon: 'car-estate',   lib: 'mci', color: '#E65100', fare: '₹150–200',eta: '8 min',  key: 'jeep',        baseFare: 60, perKm: 20 },
    '6': { icon: 'van-utility',  lib: 'mci', color: '#283593', fare: '₹200–300',eta: '12 min', key: 'private_bus', baseFare: 80, perKm: 25 },
    '7': { icon: 'bus',          lib: 'mci', color: '#00695C', fare: '₹50–100', eta: '10 min', key: 'govt_bus',    baseFare: 20, perKm: 8  },
    '8': { icon: 'taxi',         lib: 'mci', color: '#AD1457', fare: '₹100–140',eta: '6 min',  key: 'car_taxi',    baseFare: 40, perKm: 16 },
    // Ride > Share
    'rs_auto':     { icon: 'rickshaw',      lib: 'mci', color: '#2E7D32', fare: '₹60–90',    eta: '5 min',  key: 'auto',        baseFare: 30,   perKm: 13 },
    'rs_car':      { icon: 'car-hatchback', lib: 'mci', color: '#1565C0', fare: '₹120–160',  eta: '7 min',  key: 'private_car', baseFare: 50,   perKm: 18 },
    'rs_jeep':     { icon: 'car-estate',    lib: 'mci', color: '#E65100', fare: '₹150–200',  eta: '8 min',  key: 'jeep',        baseFare: 60,   perKm: 20 },
    'rs_pvt_bus':  { icon: 'van-utility',   lib: 'mci', color: '#283593', fare: '₹200–300',  eta: '12 min', key: 'private_bus', baseFare: 80,   perKm: 25 },
    'rs_govt_bus': { icon: 'bus',           lib: 'mci', color: '#00695C', fare: '₹50–100',   eta: '10 min', key: 'govt_bus',    baseFare: 20,   perKm: 8  },
    'rs_bike':     { icon: 'motorbike',     lib: 'mci', color: '#BF360C', fare: '₹35–55',    eta: '3 min',  key: 'bike',        baseFare: 20,   perKm: 10 },
    // Ride > Rent
    'rr_car':      { icon: 'car-hatchback', lib: 'mci', color: '#1565C0', fare: '₹800/hr',   eta: '10 min', key: 'rentals',     baseFare: 400,  perKm: 20 },
    'rr_jeep':     { icon: 'car-estate',    lib: 'mci', color: '#E65100', fare: '₹1000/hr',  eta: '12 min', key: 'rentals',     baseFare: 500,  perKm: 25 },
    'rr_pvt_bus':  { icon: 'van-utility',   lib: 'mci', color: '#283593', fare: '₹3000/dy',  eta: '20 min', key: 'rentals',     baseFare: 1500, perKm: 30 },
    'rr_bike':     { icon: 'motorbike',     lib: 'mci', color: '#BF360C', fare: '₹200/hr',   eta: '5 min',  key: 'rentals',     baseFare: 100,  perKm: 12 },
    // Cargo > Share
    'cs_trailer':  { icon: 'truck-trailer', lib: 'mci', color: '#4E342E', fare: '₹5000+',    eta: '30 min', key: 'package',     baseFare: 2000, perKm: 50 },
    'cs_truck':    { icon: 'truck',         lib: 'mci', color: '#37474F', fare: '₹2000+',    eta: '20 min', key: 'package',     baseFare: 800,  perKm: 30 },
    'cs_tractor':  { icon: 'tractor',       lib: 'mci', color: '#558B2F', fare: '₹800+',     eta: '15 min', key: 'package',     baseFare: 300,  perKm: 20 },
    'cs_car':      { icon: 'car-hatchback', lib: 'mci', color: '#1565C0', fare: '₹300+',     eta: '8 min',  key: 'package',     baseFare: 120,  perKm: 15 },
    'cs_bike':     { icon: 'motorbike',     lib: 'mci', color: '#BF360C', fare: '₹80+',      eta: '5 min',  key: 'package',     baseFare: 30,   perKm: 8  },
    'cs_cycle':    { icon: 'bicycle',       lib: 'mci', color: '#2E7D32', fare: '₹40+',      eta: '8 min',  key: 'package',     baseFare: 15,   perKm: 5  },
    // Cargo > Rent
    'cr_trailer':  { icon: 'truck-trailer', lib: 'mci', color: '#4E342E', fare: '₹15000/dy', eta: '45 min', key: 'rentals',     baseFare: 7500, perKm: 60 },
    'cr_truck':    { icon: 'truck',         lib: 'mci', color: '#37474F', fare: '₹8000/dy',  eta: '30 min', key: 'rentals',     baseFare: 4000, perKm: 40 },
    'cr_tractor':  { icon: 'tractor',       lib: 'mci', color: '#558B2F', fare: '₹3000/dy',  eta: '20 min', key: 'rentals',     baseFare: 1500, perKm: 25 },
    'cr_car':      { icon: 'car-hatchback', lib: 'mci', color: '#1565C0', fare: '₹800/hr',   eta: '10 min', key: 'rentals',     baseFare: 400,  perKm: 20 },
};

function RideIcon({ meta }: { meta: typeof RIDE_META[string] }) {
    return <MaterialCommunityIcons name={meta.icon as any} size={26} color={meta.color} />;
    return <Ionicons name={meta.icon as any} size={24} color={meta.color} />;
}

// ─── Map Picker Modal (booking) ──────────────────────────────────────────────
interface BMapPickerProps {
    visible: boolean;
    mode: 'pickup' | 'destination';
    initialCoords: { lat: number; lng: number } | null;
    onConfirm: (d: PlaceDetail) => void;
    onClose: () => void;
    colors: any;
}
function MapPickerModal({ visible, mode, initialCoords, onConfirm, onClose, colors }: BMapPickerProps) {
    const fallback = { latitude: INDIA_FALLBACK.latitude, longitude: INDIA_FALLBACK.longitude };
    const center   = initialCoords ? { latitude: initialCoords.lat, longitude: initialCoords.lng } : fallback;
    const [pin, setPin]         = useState(center);
    const [label, setLabel]     = useState('');
    const [loading, setLoading] = useState(false);
    const accent = mode === 'pickup' ? '#4CAF50' : '#F44336';

    useEffect(() => {
        if (visible) {
            const c = initialCoords ? { latitude: initialCoords.lat, longitude: initialCoords.lng } : fallback;
            setPin(c); setLabel('');
        }
    }, [visible]);

    const onRegionChangeComplete = async (region: Region) => {
        const coords = { latitude: region.latitude, longitude: region.longitude };
        setPin(coords); setLoading(true);
        const geo = await reverseGeocode(region.latitude, region.longitude);
        setLabel(geo?.subLocality ? `${geo.subLocality}, ${geo.locality}` : geo?.formattedAddress ?? `${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
        setLoading(false);
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <View style={[bmp.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={bmp.back}><Ionicons name="arrow-back" size={22} color={colors.text} /></TouchableOpacity>
                    <Text style={[bmp.title, { color: colors.text }]}>{mode === 'pickup' ? 'Set Pickup on Map' : 'Set Destination on Map'}</Text>
                    <View style={{ width: 36 }} />
                </View>
                <View style={{ flex: 1 }}>
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={StyleSheet.absoluteFillObject}
                        initialRegion={{ ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                        showsUserLocation
                        showsMyLocationButton={false}
                        onRegionChangeComplete={onRegionChangeComplete}
                    />
                    <View style={bmp.pinWrap} pointerEvents="none">
                        <View style={[bmp.pinCircle, { backgroundColor: accent }]}>
                            <Ionicons name={mode === 'pickup' ? 'radio-button-on' : 'location'} size={20} color="#fff" />
                        </View>
                        <View style={[bmp.pinTail, { backgroundColor: accent }]} />
                        <View style={[bmp.pinShadow, { backgroundColor: accent + '30' }]} />
                    </View>
                </View>
                <View style={[bmp.bottom, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                    <View style={[bmp.labelRow, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                        <Ionicons name="location-outline" size={18} color={accent} />
                        {loading
                            ? <ActivityIndicator size="small" color={accent} style={{ marginLeft: 8 }} />
                            : <Text style={[bmp.labelTxt, { color: colors.text }]} numberOfLines={2}>{label || 'Move map to set location'}</Text>
                        }
                    </View>
                    <TouchableOpacity
                        style={[bmp.confirmBtn, { backgroundColor: accent }]}
                        onPress={() => onConfirm({ placeId: `map_${pin.latitude}_${pin.longitude}`, name: label || 'Selected location', formattedAddress: label || `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`, lat: pin.latitude, lng: pin.longitude })}
                        disabled={loading || !label}
                        activeOpacity={0.85}
                    >
                        <Text style={bmp.confirmTxt}>Confirm {mode === 'pickup' ? 'Pickup' : 'Drop'}</Text>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
}
const bmp = StyleSheet.create({
    header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
    back:       { padding: 6 },
    title:      { fontSize: 16, fontWeight: '700' },
    pinWrap:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    pinCircle:  { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', elevation: 8, marginBottom: -4 },
    pinTail:    { width: 3, height: 14, borderRadius: 2 },
    pinShadow:  { width: 20, height: 8, borderRadius: 10, marginTop: -2 },
    bottom:     { paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 20, borderTopWidth: 1, gap: 12 },
    labelRow:   { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
    labelTxt:   { flex: 1, fontSize: 14, fontWeight: '500' },
    confirmBtn: { borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    confirmTxt: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ─── Inline location search modal ────────────────────────────────────────────
interface SearchModalProps {
    visible: boolean;
    mode: 'pickup' | 'destination';
    initialValue: string;
    onSelect: (d: PlaceDetail) => void;
    onPickOnMap: () => void;
    onClose: () => void;
    colors: any;
}
function LocationSearchModal({ visible, mode, initialValue, onSelect, onPickOnMap, onClose, colors }: SearchModalProps) {
    const [query, setQuery]             = useState(initialValue);
    const [preds, setPreds]             = useState<PlacePrediction[]>([]);
    const [loading, setLoading]         = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef    = useRef<TextInput>(null);
    const accent      = mode === 'pickup' ? '#4CAF50' : '#F44336';

    useEffect(() => {
        if (visible) { setQuery(initialValue); setTimeout(() => inputRef.current?.focus(), 300); }
    }, [visible, initialValue]);

    useEffect(() => {
        if (!query.trim()) { setPreds([]); return; }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            const results = await fetchPlacePredictions(query);
            setPreds(results);
            setLoading(false);
        }, 400);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query]);

    const handleSelect = async (pred: PlacePrediction) => {
        Keyboard.dismiss();
        const detail = await fetchPlaceDetails(pred.placeId);
        if (detail) onSelect(detail);
        else Alert.alert('Error', 'Could not load place details.');
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
                <View style={[bsm.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={bsm.back}>
                        <Ionicons name="arrow-back" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={[bsm.inputWrap, { backgroundColor: colors.inputBg, borderColor: accent }]}>
                        <View style={[bsm.dot, { backgroundColor: accent }]} />
                        <TextInput
                            ref={inputRef}
                            style={[bsm.input, { color: colors.text }]}
                            placeholder={mode === 'pickup' ? 'Search pickup…' : 'Search destination…'}
                            placeholderTextColor={colors.subText}
                            value={query}
                            onChangeText={setQuery}
                            clearButtonMode="while-editing"
                        />
                        {loading && <ActivityIndicator size="small" color={accent} />}
                    </View>
                </View>
                {/* Pick on Map */}
                <TouchableOpacity
                    style={[bsm.mapPickRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}
                    onPress={onPickOnMap}
                    activeOpacity={0.8}
                >
                    <View style={[bsm.rowIcon, { backgroundColor: accent + '20' }]}>
                        <Ionicons name="map-outline" size={20} color={accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[bsm.mainTxt, { color: colors.text }]}>Pick on Map</Text>
                        <Text style={[bsm.subTxt, { color: colors.subText }]}>Drag the pin to exact location</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.subText} />
                </TouchableOpacity>
                <FlatList
                    data={preds}
                    keyExtractor={i => i.placeId}
                    keyboardShouldPersistTaps="always"
                    ListEmptyComponent={query.trim() && !loading ? <Text style={[bsm.empty, { color: colors.subText }]}>No results</Text> : null}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={[bsm.row, { borderBottomColor: colors.border }]} onPress={() => handleSelect(item)}>
                            <View style={[bsm.rowIcon, { backgroundColor: colors.iconBg }]}>
                                <Ionicons name="location-outline" size={18} color={accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[bsm.mainTxt, { color: colors.text }]} numberOfLines={1}>{item.mainText}</Text>
                                <Text style={[bsm.subTxt, { color: colors.subText }]} numberOfLines={1}>{item.secondaryText}</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            </SafeAreaView>
        </Modal>
    );
}
const bsm = StyleSheet.create({
    header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
    back:        { padding: 6 },
    inputWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 2, paddingHorizontal: 10, height: 44, gap: 8 },
    dot:         { width: 10, height: 10, borderRadius: 5 },
    input:       { flex: 1, fontSize: 15, fontWeight: '500' },
    mapPickRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
    row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
    rowIcon:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    mainTxt:     { fontSize: 14, fontWeight: '600' },
    subTxt:      { fontSize: 12, marginTop: 2 },
    empty:       { textAlign: 'center', padding: 32, fontSize: 14 },
});

// ─── Fellow Travelers (Co-Passenger Safety) ──────────────────────────────────
// Only anonymised info is shown: first name + last initial + area/village.
// No phone, full name, photo, or exact address is ever exposed.

interface CoPassenger {
    id: string;
    firstName: string;
    lastInitial: string;
    area: string;        // village / town only — never a street
    color: string;       // avatar background
    gender: 'M' | 'F';
    genderLabel: 'Male' | 'Female';
    age: number;         // 18–65
}

const _CP_NAMES: [string, string, 'M' | 'F'][] = [
    ['Ramesh',  'K', 'M'], ['Sunita',  'D', 'F'], ['Mohan',   'S', 'M'],
    ['Priya',   'Y', 'F'], ['Aniket',  'P', 'M'], ['Kavita',  'R', 'F'],
    ['Suresh',  'M', 'M'], ['Geeta',   'T', 'F'], ['Deepak',  'B', 'M'],
    ['Laxmi',   'C', 'F'], ['Vinod',   'N', 'M'], ['Sita',    'G', 'F'],
    ['Rajesh',  'V', 'M'], ['Anita',   'J', 'F'], ['Mukesh',  'L', 'M'],
    ['Pushpa',  'W', 'F'], ['Dinesh',  'A', 'M'], ['Rekha',   'H', 'F'],
    ['Santosh', 'U', 'M'], ['Kamla',   'E', 'F'], ['Vikram',  'O', 'M'],
    ['Savita',  'F', 'F'], ['Rakesh',  'I', 'M'], ['Meena',   'Q', 'F'],
];
const _CP_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#DDA0DD', '#98D8C8', '#F7B731', '#26de81',
    '#a29bfe', '#fd79a8', '#00b894', '#e17055',
];

/** Deterministic integer hash (djb2-like) */
function _strHash(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h);
}

/**
 * Extracts just the village / town name from a full address label.
 * e.g. "123 Main St, Rampur, Uttar Pradesh 271895" → "Rampur"
 */
function _extractArea(label: string): string {
    if (!label) return 'your area';
    const parts = label.split(',').map(p => p.trim()).filter(Boolean);
    // Prefer the 2nd segment (usually city/town), fallback to 1st
    const raw = parts.length >= 2 ? parts[1] : parts[0];
    // Strip pin codes and long segments
    const clean = raw.replace(/\d{5,}/g, '').trim();
    return clean || 'your area';
}

/**
 * Deterministically generates 1–4 anonymised co-passengers for a given
 * pickup + destination pair.  The same route always produces the same list
 * so the UI looks consistent; no real user data is used.
 */
function generateCoPassengers(pickupLabel: string, destLabel: string): CoPassenger[] {
    if (!pickupLabel || !destLabel) return [];
    const h     = _strHash(pickupLabel.toLowerCase() + '|' + destLabel.toLowerCase());
    // 20% chance of 0 co-pax (very rural / off-peak), otherwise 1–4
    const rem   = h % 10;
    const count = rem < 2 ? 0 : rem < 5 ? 1 : rem < 8 ? 2 : rem < 10 ? 3 : 4;
    if (count === 0) return [];
    const area = _extractArea(pickupLabel);
    return Array.from({ length: count }, (_, i) => {
        const nIdx = (h + i * 13) % _CP_NAMES.length;
        const cIdx = (h + i * 7)  % _CP_COLORS.length;
        const [firstName, lastInitial, gender] = _CP_NAMES[nIdx];
        const age = 18 + ((h + i * 17) % 48);   // 18–65
        return { id: `cp-${i}`, firstName, lastInitial, area, color: _CP_COLORS[cIdx], gender, genderLabel: gender === 'M' ? 'Male' : 'Female' as 'Male' | 'Female', age };
    });
}

// ── FellowTravelersCard component ─────────────────────────────────────────────
// Only shown for Sharing & Government ride types (not Private)
const SHARING_RIDE_IDS = ['1', '2', '4', 'rs_auto', 'rs_bike', 'rs_car', 'cs_bike', 'cs_cycle', 'cs_car', 'cs_truck', 'cs_trailer', 'cs_tractor'];
const GOVT_RIDE_IDS    = ['6', '7', 'rs_govt_bus'];

function FellowTravelersCard({ pickup, dest, myPassengerCount, rideType, s, colors }: {
    pickup: string; dest: string; myPassengerCount: number; rideType: string; s: any; colors: any;
}) {
    const [expanded, setExpanded] = React.useState(false);
    const passengers = React.useMemo(
        () => generateCoPassengers(pickup, dest),
        [pickup, dest],
    );
    // Only render for Sharing & Government rides
    if (!SHARING_RIDE_IDS.includes(rideType) && !GOVT_RIDE_IDS.includes(rideType)) return null;
    if (passengers.length === 0) return null;

    const total   = passengers.length + myPassengerCount;
    const visible = expanded ? passengers : passengers.slice(0, 2);

    return (
        <View style={s.ftCard}>
            {/* ── Header ── */}
            <View style={s.ftHeader}>
                <View style={s.ftShieldWrap}>
                    <Ionicons name="shield-checkmark" size={20} color="#2E7D32" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.ftTitle}>Fellow Travelers</Text>
                    <Text style={s.ftSubtitle}>People from your area on this vehicle</Text>
                </View>
                {/* Total count pill */}
                <View style={s.ftTotalPill}>
                    <Ionicons name="people" size={14} color="#1565C0" />
                    <Text style={s.ftTotalNum}>{total}</Text>
                    <Text style={s.ftTotalLabel}> riding</Text>
                </View>
            </View>

            {/* ── Stacked avatars + summary ── */}
            <View style={s.ftAvatarRow}>
                {passengers.slice(0, 5).map((p, idx) => (
                    <View
                        key={p.id}
                        style={[s.ftStackAvatar, { backgroundColor: p.color, marginLeft: idx === 0 ? 0 : -12, zIndex: 20 - idx }]}
                    >
                        <Text style={s.ftStackAvatarTxt}>{p.firstName[0]}{p.lastInitial}</Text>
                    </View>
                ))}
                {passengers.length > 5 && (
                    <View style={[s.ftStackAvatar, { backgroundColor: '#B0BEC5', marginLeft: -12, zIndex: 1 }]}>
                        <Text style={s.ftStackAvatarTxt}>+{passengers.length - 5}</Text>
                    </View>
                )}
                <Text style={s.ftAvatarSummary}>
                    {passengers.length === 1
                        ? '1 neighbour on board'
                        : `${passengers.length} neighbours on board`}
                </Text>
            </View>

            {/* ── Passenger rows ── */}
            {visible.map((p) => (
                <View key={p.id} style={s.ftRow}>
                    <View style={[s.ftRowDot, { backgroundColor: p.color }]}>
                        <Text style={s.ftRowDotTxt}>{p.firstName[0]}{p.lastInitial}</Text>
                    </View>
                    <View style={s.ftRowInfo}>
                        {/* Only first name + last initial — never full last name */}
                        <Text style={s.ftRowName}>{p.firstName} {p.lastInitial}.</Text>
                        <View style={s.ftRowAreaRow}>
                            <Ionicons name="person-outline" size={11} color={colors.subText} />
                            <Text style={s.ftRowArea}>{p.genderLabel}, Age {p.age}</Text>
                        </View>
                        <View style={s.ftRowAreaRow}>
                            <Ionicons name="location-outline" size={11} color={colors.subText} />
                            <Text style={s.ftRowArea}>{p.area}</Text>
                        </View>
                    </View>
                    <View style={s.ftVerifiedBadge}>
                        <Ionicons name="checkmark-circle" size={13} color="#2E7D32" />
                        <Text style={s.ftVerifiedTxt}>Verified</Text>
                    </View>
                </View>
            ))}

            {/* ── Show more / less ── */}
            {passengers.length > 2 && (
                <TouchableOpacity style={s.ftToggleBtn} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
                    <Text style={s.ftToggleTxt}>{expanded ? 'Show less ▲' : `Show ${passengers.length - 2} more ▼`}</Text>
                </TouchableOpacity>
            )}

            {/* ── Privacy notice ── */}
            <View style={s.ftPrivacyRow}>
                <Ionicons name="lock-closed-outline" size={11} color={colors.subText} />
                <Text style={s.ftPrivacyTxt}>
                    Full details are private · Only area shown for your safety
                </Text>
            </View>
        </View>
    );
}

// ─── Driver data helpers ──────────────────────────────────────────────────────
const _DRIVER_FIRST = ['Ramesh','Sunil','Deepak','Anil','Rajesh','Mohan','Vikas','Santosh','Pradeep','Dinesh','Arjun','Manoj','Hemant','Bharat','Sanjay'];
const _DRIVER_LAST  = ['Kumar','Singh','Patel','Sharma','Yadav','Gupta','Mishra','Tiwari','Verma','Dubey','Joshi','Nair','Reddy','Chauhan','Mehta'];
const _VEH_COLORS   = ['White','Black','Silver','Red','Blue','Grey','Yellow','Green','Orange'];
const _LANG_OPTS    = ['Hindi','Bhojpuri','Awadhi','Maithili','English'];
const _PLATES       = ['UP32 AX 4421','UP70 BC 1234','UP78 CD 5678','UP41 EF 9012','MH14 GH 3456','DL01 KL 2345','RJ14 MN 6789','GJ01 OP 1357'];

function _dHash(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) & 0xffffffff;
    return Math.abs(h);
}

export interface DriverInfo {
    id: string;
    firstName: string; lastName: string;
    rating: number; trips: number;
    plate: string; vehicleColor: string; vehicleModel: string;
    languages: string[];
    etaToPickup: number;   // minutes
    avatarColor: string;
}

const _AVATAR_COLORS = ['#E53935','#1E88E5','#43A047','#8E24AA','#FF6F00','#00897B','#D81B60','#3949AB'];
const _VEH_MODELS: Record<string, string[]> = {
    '1': ['Bajaj Pulsar','Hero Splendor','Honda Shine','TVS Apache'],
    '2': ['Bajaj RE Auto','Piaggio Ape','TVS King Auto'],
    '3': ['Maruti Swift','Hyundai i20','Honda City','Maruti Dzire'],
    '4': ['Honda Activa','TVS Jupiter','Hero Maestro'],
    '5': ['Mahindra Bolero','Toyota Innova','Force Gurkha'],
    '6': ['Force Traveller','Mahindra Bolero Camper','Tata Winger'],
    '7': ['Tata Bus','Ashok Leyland Bus','Eicher Bus'],
    '8': ['Maruti Swift','Hyundai i20','Toyota Etios'],
    'rs_auto':     ['Bajaj RE Auto','Piaggio Ape','TVS King Auto'],
    'rs_car':      ['Maruti Swift','Hyundai i20','Honda City','Maruti Dzire'],
    'rs_jeep':     ['Mahindra Bolero','Force Gurkha','Mahindra Thar'],
    'rs_pvt_bus':  ['Force Traveller','Tata Winger','Mahindra Bolero Camper'],
    'rs_govt_bus': ['Tata Bus','Ashok Leyland Bus','Eicher Bus'],
    'rs_bike':     ['Hero Splendor','Honda Shine','Bajaj Pulsar'],
    'rr_car':      ['Maruti Swift','Hyundai Venue','Honda City'],
    'rr_jeep':     ['Mahindra Thar','Force Gurkha','Mahindra Scorpio'],
    'rr_pvt_bus':  ['Force Traveller','Mahindra Bolero Camper','Tata Winger'],
    'rr_bike':     ['Royal Enfield Bullet','Hero Splendor','Honda Shine'],
    'cs_trailer':  ['Ashok Leyland Trailer','Tata Prima','BharatBenz Trailer'],
    'cs_truck':    ['Tata 407','Mahindra Bolero Pickup','Ashok Leyland Dost'],
    'cs_tractor':  ['Mahindra 575','Sonalika 60','John Deere 5075'],
    'cs_car':      ['Maruti Omni','Tata Ace','Mahindra Supro'],
    'cs_bike':     ['Hero Splendor','Honda Shine','Bajaj Pulsar'],
    'cs_cycle':    ['Atlas Bicycle','BSA Cycle','Hero Cycle'],
    'cr_trailer':  ['Ashok Leyland Trailer','Tata Prima','BharatBenz Trailer'],
    'cr_truck':    ['Tata 407','Ashok Leyland Dost','Mahindra Bolero Pickup'],
    'cr_tractor':  ['Mahindra 575','Sonalika 60','John Deere 5075'],
    'cr_car':      ['Maruti Omni','Tata Ace','Mahindra Supro'],
};

export function generateDriver(rideType: string, pickupLabel: string): DriverInfo {
    const h    = _dHash(rideType + '|' + pickupLabel);
    const fn   = _DRIVER_FIRST[h % _DRIVER_FIRST.length];
    const ln   = _DRIVER_LAST[(h >> 4) % _DRIVER_LAST.length];
    const models = _VEH_MODELS[rideType] ?? _VEH_MODELS['3'];
    const model  = models[(h >> 8) % models.length];
    const plate  = _PLATES[(h >> 12) % _PLATES.length];
    const color  = _VEH_COLORS[(h >> 16) % _VEH_COLORS.length];
    const lang1  = _LANG_OPTS[h % _LANG_OPTS.length];
    const lang2  = _LANG_OPTS[(h + 2) % _LANG_OPTS.length];
    const trips  = 200 + (h % 1200);
    const rating = 3.8 + (_dHash(fn + ln) % 12) / 10;   // 3.8–5.0
    return {
        id:            `drv-${h}`,
        firstName:     fn,
        lastName:      ln,
        rating:        Math.round(rating * 10) / 10,
        trips,
        plate,
        vehicleColor:  color,
        vehicleModel:  model,
        languages:     lang1 === lang2 ? [lang1] : [lang1, lang2],
        etaToPickup:   1 + (h % 6),
        avatarColor:   _AVATAR_COLORS[h % _AVATAR_COLORS.length],
    };
}

// ─── Trusted contacts storage ─────────────────────────────────────────────────
const TC_KEY = 'gaon_trusted_contacts';
interface TrustedContact { id: string; name: string; phone: string }

// ─── DriverSearchModal ────────────────────────────────────────────────────────
type SearchPhase = 'searching' | 'accepting' | 'accepted';

function formatEta(mins: number): string {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface DriverSearchModalProps {
    visible: boolean;
    phase: SearchPhase;
    driver: DriverInfo | null;
    rideType: string;
    passengerCount: number;
    countdown: number;
    pickupLabel: string;
    destLabel: string;
    onCancel: () => void;
    onChangeVehicle: () => void;
    onCallDriver: () => void;
    colors: any;
}

function StarRow({ rating }: { rating: number }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {[1,2,3,4,5].map(i => (
                <Ionicons
                    key={i}
                    name={i <= Math.round(rating) ? 'star' : 'star-outline'}
                    size={13}
                    color="#FFC82C"
                />
            ))}
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#333', marginLeft: 4 }}>{rating.toFixed(1)}</Text>
        </View>
    );
}

function PulsingDot({ color }: { color: string }) {
    const scale = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(scale, { toValue: 1.6, duration: 600, useNativeDriver: true }),
                Animated.timing(scale, { toValue: 1,   duration: 600, useNativeDriver: true }),
            ])
        ).start();
    }, [scale]);
    return (
        <Animated.View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color, transform: [{ scale }], opacity: 0.85 }} />
    );
}

function DriverSearchModal({ visible, phase, driver, rideType, passengerCount, countdown, pickupLabel, destLabel, onCancel, onChangeVehicle, onCallDriver, colors }: DriverSearchModalProps) {
    const meta = RIDE_META[rideType];
    const slideAnim = useRef(new Animated.Value(300)).current;
    const { rideMinimized, setRideMinimized } = useActiveRide();

    // ── Chat sheet state ───────────────────────────────────────────────────────
    const [chatVisible, setChatVisible]   = useState(false);
    const [chatMsg, setChatMsg]           = useState('');
    const [chatHistory, setChatHistory]   = useState<{ from: 'rider' | 'driver'; text: string }[]>([]);
    const [ftModalVisible, setFtModalVisible] = useState(false);

    const coPassengers = useMemo(() => {
        if (!driver) return [];
        if (!SHARING_RIDE_IDS.includes(rideType) && !GOVT_RIDE_IDS.includes(rideType)) return [];
        return generateCoPassengers(pickupLabel, destLabel);
    }, [driver?.id, pickupLabel, destLabel, rideType]);

    const QUICK_REPLIES = [
        'On my way 🚶',
        "I'm at the pickup",
        'Please wait 2 min',
        'Please wait 5 min',
        'Where are you?',
        'Can you call me?',
    ];

    const sendMsg = (text: string) => {
        if (!text.trim()) return;
        setChatHistory(prev => [...prev, { from: 'rider', text: text.trim() }]);
        setChatMsg('');
        // Simulate driver acknowledgement
        setTimeout(() => {
            setChatHistory(prev => [...prev, { from: 'driver', text: 'OK, noted 👍' }]);
        }, 1500);
    };

    // ── Cancel Trip reasons state ──────────────────────────────────────────────
    const [cancelVisible, setCancelVisible]     = useState(false);
    const [selectedReason, setSelectedReason]   = useState<string | null>(null);
    const [otherReason, setOtherReason]         = useState('');

    const CANCEL_REASONS = [
        'Driver is taking too long',
        'I found another ride',
        'Changed my travel plans',
        'Wrong pickup location entered',
        'Other',
    ];

    const confirmCancel = () => {
        const reason = selectedReason === 'Other' ? (otherReason.trim() || 'Other') : selectedReason;
        if (!reason) { Alert.alert('Select a reason', 'Please select a reason for cancellation.'); return; }
        setCancelVisible(false);
        onCancel();
        Alert.alert('Trip Cancelled', `Reason: ${reason}`);
    };

    // ── Share Trip (trusted contacts) ──────────────────────────────────────────
    const [shareVisible, setShareVisible]         = useState(false);
    const [trustedContacts, setTrustedContacts]   = useState<TrustedContact[]>([]);
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [tcChatVisible, setTcChatVisible]       = useState(false);
    const [tcChatContact, setTcChatContact]       = useState<TrustedContact | null>(null);
    const [tcChatMsg, setTcChatMsg]               = useState('');
    const [tcChatHistory, setTcChatHistory]       = useState<{ from: 'me' | 'contact'; text: string }[]>([]);

    useEffect(() => {
        if (shareVisible) {
            AsyncStorage.getItem(TC_KEY).then(raw => {
                if (raw) setTrustedContacts(JSON.parse(raw));
            });
        }
    }, [shareVisible]);

    // ── Arrival phase simulation ──────────────────────────────────────────────
    const [arrivalPhase, setArrivalPhase] = useState<'en_route' | 'arrived'>('en_route');
    const arrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (phase === 'accepted' && driver) {
            setArrivalPhase('en_route');
            // Demo: simulate driver arrival after 12 s. In production use driver.etaToPickup * 60 s.
            arrivalTimerRef.current = setTimeout(() => setArrivalPhase('arrived'), 12000);
        }
        return () => { if (arrivalTimerRef.current) clearTimeout(arrivalTimerRef.current); };
    }, [phase, driver?.id]);

    const toggleContact = (id: string) =>
        setSelectedContacts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const shareTrip = () => {
        if (selectedContacts.length === 0) { Alert.alert('Select contacts', 'Choose at least one contact to share with.'); return; }
        const names = trustedContacts.filter(c => selectedContacts.includes(c.id)).map(c => c.name).join(', ');
        const link = `https://gaon.app/ride/${driver?.id ?? 'demo'}`;
        setShareVisible(false);
        setSelectedContacts([]);
        Alert.alert('Trip Shared! 🔗', `Live ride link sent to: ${names}\n\nLink: ${link}`);
    };

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        } else {
            slideAnim.setValue(300);
        }
    }, [visible, slideAnim]);

    return (
        <>
        <Modal visible={visible && !rideMinimized} transparent animationType="none" statusBarTranslucent>
            <View style={dsm.overlay}>
                <Animated.View style={[dsm.sheet, phase === 'accepted' && { minHeight: '80%' } as any, { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }]}>

                    {/* ── SEARCHING phase ── */}
                    {phase === 'searching' && (
                        <View style={dsm.phaseWrap}>
                            <ActivityIndicator size="large" color={meta?.color ?? YELLOW} />
                            <Text style={[dsm.phaseTitle, { color: colors.text }]}>Finding drivers nearby…</Text>
                            <Text style={[dsm.phaseSub, { color: colors.subText }]}>Contacting drivers in your area</Text>
                            <View style={dsm.paxCountRow}>
                                <Ionicons name="people" size={16} color={meta?.color ?? YELLOW} />
                                <Text style={[dsm.paxCountTxt, { color: colors.text }]}>
                                    {passengerCount} passenger{passengerCount !== 1 ? 's' : ''} waiting for this ride
                                </Text>
                            </View>
                            <View style={dsm.dotRow}>
                                {[meta?.color ?? YELLOW, '#aaa', '#ccc'].map((c, i) => (
                                    <View key={i} style={[dsm.dotStep, { backgroundColor: c }]} />
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ── DRIVER ACCEPTING phase ── */}
                    {phase === 'accepting' && driver && (
                        <View style={dsm.phaseWrap}>
                            {/* Request sent banner */}
                            <View style={[dsm.requestBanner, { backgroundColor: '#E3F2FD' }]}>
                                <Ionicons name="send" size={16} color="#1565C0" />
                                <Text style={[dsm.requestBannerTxt, { color: '#1565C0' }]}>
                                    Ride request sent to driver
                                </Text>
                            </View>

                            <PulsingDot color="#4CAF50" />
                            <Text style={[dsm.phaseTitle, { color: colors.text, marginTop: 6 }]}>Waiting for driver…</Text>
                            <Text style={[dsm.phaseSub, { color: colors.subText }]}>Driver has {countdown > 0 ? countdown : 30}s to accept your request</Text>

                            {/* Countdown ring — always visible */}
                            <View style={dsm.countdownWrap}>
                                <Text style={[dsm.countdownNum, { color: countdown <= 10 && countdown > 0 ? '#E53935' : colors.text }]}>
                                    {countdown > 0 ? countdown : 30}
                                </Text>
                                <Text style={[dsm.countdownLabel, { color: colors.subText }]}>sec remaining</Text>
                            </View>

                            <View style={[dsm.miniCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                                <View style={[dsm.avatarCircle, { backgroundColor: driver.avatarColor }]}>
                                    <Text style={dsm.avatarTxt}>{driver.firstName[0]}{driver.lastName[0]}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[dsm.miniName, { color: colors.text }]}>{driver.firstName} {driver.lastName}</Text>
                                    <StarRow rating={driver.rating} />
                                    <Text style={{ fontSize: 12, color: colors.subText, marginTop: 2 }}>{driver.vehicleModel} · {driver.plate}</Text>
                                </View>
                                <MaterialCommunityIcons name={meta?.icon as any ?? 'car'} size={24} color={meta?.color ?? YELLOW} />
                            </View>

                            {/* Change vehicle / Cancel request buttons */}
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
                                <TouchableOpacity
                                    style={[dsm.cancelBtn, { borderColor: '#1565C0', flex: 1, alignItems: 'center' }]}
                                    onPress={onChangeVehicle}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[dsm.cancelTxt, { color: '#1565C0' }]}>Change Vehicle</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[dsm.cancelBtn, { borderColor: '#C62828', flex: 1, alignItems: 'center' }]}
                                    onPress={onCancel}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[dsm.cancelTxt, { color: '#C62828' }]}>Cancel Request</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ── ACCEPTED phase ── */}
                    {phase === 'accepted' && driver && (
                        <View style={{ flex: 1 }}>
                            {/* Handle + icon-only minimize */}
                            <View style={dsm.acceptedTopBar}>
                                <View style={{ flex: 1 }} />
                                <View style={[dsm.sheetHandle, { backgroundColor: colors.border }]} />
                                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                    <TouchableOpacity
                                        style={dsm.minimizeBtn}
                                        onPress={() => setRideMinimized(true)}
                                        activeOpacity={0.8}
                                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                    >
                                        <Ionicons name="chevron-down" size={22} color={colors.subText} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* ── Step Progress Indicator ── */}
                            <View style={dsm.stepRow}>
                                {['Confirmed', 'En Route', 'Arrived', 'Start Trip'].map((lbl, i) => {
                                    const stepIdx = arrivalPhase === 'arrived' ? 2 : 1;
                                    const done    = i < stepIdx;
                                    const active  = i === stepIdx;
                                    return (
                                        <React.Fragment key={i}>
                                            <View style={{ alignItems: 'center', flex: 1 }}>
                                                <View style={[dsm.stepDot, {
                                                    backgroundColor: done ? '#2E7D32' : active ? YELLOW : colors.border,
                                                }]}>
                                                    {done
                                                        ? <Ionicons name="checkmark" size={10} color="#fff" />
                                                        : <Text style={[dsm.stepDotTxt, { color: active ? '#1A1A1A' : '#fff' }]}>{i + 1}</Text>
                                                    }
                                                </View>
                                                <Text style={[dsm.stepLbl, { color: (done || active) ? colors.text : colors.subText }]}>{lbl}</Text>
                                            </View>
                                            {i < 3 && <View style={[dsm.stepLine, { backgroundColor: done ? '#2E7D32' : colors.border, flex: 1, marginBottom: 14 }]} />}
                                        </React.Fragment>
                                    );
                                })}
                            </View>

                            {/* Full-width banner — changes color & text on arrival */}
                            <View style={[dsm.acceptedBanner, arrivalPhase === 'arrived' && { backgroundColor: '#E65100' }]}>
                                <View style={dsm.bannerCheckCircle}>
                                    <Ionicons name={arrivalPhase === 'arrived' ? 'car' : 'checkmark'} size={24} color="#fff" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    {arrivalPhase === 'arrived' ? (
                                        <>
                                            <Text style={dsm.acceptedTitle}>Driver Arrived! 🚗</Text>
                                            <Text style={dsm.acceptedVehicle}>{driver.vehicleModel} · {driver.plate}</Text>
                                            <Text style={dsm.acceptedSub}>Board the vehicle & share your OTP</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Text style={dsm.acceptedTitle}>Booked! 🎉</Text>
                                            <Text style={dsm.acceptedVehicle}>{driver.vehicleModel} · {driver.plate}</Text>
                                            <Text style={dsm.acceptedSub}>{driver.vehicleColor}</Text>
                                        </>
                                    )}
                                </View>
                                <View style={dsm.etaBadge}>
                                    <Text style={dsm.etaBadgeNum}>{arrivalPhase === 'arrived' ? '0' : formatEta(driver.etaToPickup)}</Text>
                                    <Text style={dsm.etaBadgeLbl}>{arrivalPhase === 'arrived' ? 'Here Now' : 'Arriving In'}</Text>
                                </View>
                            </View>

                            {/* Scrollable: driver section + vehicle info + OTP + actions */}
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                {/* Driver row */}
                                <View style={[dsm.driverSection, { borderBottomColor: colors.border }]}>
                                    <View style={[dsm.avatarLg, { backgroundColor: driver.avatarColor }]}>
                                        <Text style={dsm.avatarTxtLg}>{driver.firstName[0]}{driver.lastName[0]}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 14 }}>
                                        <Text style={[dsm.driverName, { color: colors.text }]}>{driver.firstName} {driver.lastName}</Text>
                                        <Text style={[dsm.driverMeta, { color: colors.subText }]}>
                                            ⭐ {driver.rating.toFixed(1)}  ·  {driver.trips.toLocaleString('en-IN')} trips  ·  {driver.languages.join(', ')}
                                        </Text>
                                    </View>
                                    <View style={[dsm.verBadge, { backgroundColor: '#E8F5E9' }]}>
                                        <Ionicons name="shield-checkmark" size={12} color="#2E7D32" />
                                        <Text style={dsm.verTxt}>Verified</Text>
                                    </View>
                                </View>

                                {/* OTP card */}
                                <View style={[dsm.otpCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>

                                {/* Fellow travellers badge — only for sharing/govt rides */}
                                {coPassengers.length > 0 && (
                                    <TouchableOpacity
                                        style={[dsm.ftBadgeRow, { backgroundColor: '#E3F2FD', borderColor: '#BBDEFB' }]}
                                        onPress={() => setFtModalVisible(true)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={dsm.ftBadgeIcon}>
                                            <Ionicons name="people" size={16} color="#1565C0" />
                                        </View>
                                        <Text style={[dsm.ftBadgeTxt, { color: '#1565C0' }]}>
                                            {coPassengers.length} fellow traveller{coPassengers.length > 1 ? 's' : ''} on this vehicle
                                        </Text>
                                        <View style={dsm.ftCountBubble}>
                                            <Text style={dsm.ftCountBubbleTxt}>{coPassengers.length}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={15} color="#1565C0" />
                                    </TouchableOpacity>
                                )}
                                    <View style={dsm.otpIconWrap}>
                                        <Ionicons name="key" size={18} color="#E65100" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[dsm.otpLabel, { color: colors.subText }]}>Ride OTP — share only after boarding</Text>
                                        <Text style={[dsm.otpCode, { color: colors.text }]}>
                                            {String(4271 + parseInt(driver.id.replace(/\D/g, '').slice(-3) || '0')).slice(0, 4)}
                                        </Text>
                                    </View>
                                </View>

                                {/* Action buttons — 2×2 grid */}
                                <View style={dsm.actionRow}>
                                    <TouchableOpacity style={[dsm.actionBtn, { backgroundColor: '#E8F5E9' }]} onPress={onCallDriver} activeOpacity={0.8}>
                                        <Ionicons name="call" size={26} color="#2E7D32" />
                                        <Text style={[dsm.actionBtnTxt, { color: '#2E7D32' }]}>Call Driver</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[dsm.actionBtn, { backgroundColor: '#E3F2FD' }]} onPress={() => setChatVisible(true)} activeOpacity={0.8}>
                                        <Ionicons name="chatbubble-ellipses" size={26} color="#1565C0" />
                                        <Text style={[dsm.actionBtnTxt, { color: '#1565C0' }]}>Chat</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[dsm.actionBtn, { backgroundColor: '#E8F0FE' }]} onPress={() => setShareVisible(true)} activeOpacity={0.8}>
                                        <Ionicons name="share-social-outline" size={26} color="#3949AB" />
                                        <Text style={[dsm.actionBtnTxt, { color: '#3949AB' }]}>Share Trip</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[dsm.actionBtn, { backgroundColor: '#FFEBEE' }]} onPress={() => { setSelectedReason(null); setOtherReason(''); setCancelVisible(true); }} activeOpacity={0.8}>
                                        <Ionicons name="close-circle-outline" size={26} color="#C62828" />
                                        <Text style={[dsm.actionBtnTxt, { color: '#C62828' }]}>Cancel Trip</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </View>
                    )}
                </Animated.View>
            </View>
        </Modal>

        {/* ── FELLOW TRAVELLERS MODAL ── */}
        {driver && coPassengers.length > 0 && (
            <Modal visible={ftModalVisible} transparent animationType="slide" onRequestClose={() => setFtModalVisible(false)}>
                <TouchableOpacity style={dsm.chatOverlay} activeOpacity={1} onPress={() => setFtModalVisible(false)}>
                    <TouchableOpacity activeOpacity={1}>
                    <View style={[dsm.chatSheet, { backgroundColor: colors.card }]}>
                        <View style={[dsm.chatHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[dsm.chatTitle, { color: colors.text }]}>Fellow Travellers</Text>
                            <TouchableOpacity onPress={() => setFtModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                            <FellowTravelersCard
                                pickup={pickupLabel}
                                dest={destLabel}
                                myPassengerCount={passengerCount}
                                rideType={rideType}
                                s={dsm}
                                colors={colors}
                            />
                        </ScrollView>
                    </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        )}

        {/* ── CHAT SHEET ── */}
        <Modal visible={chatVisible} transparent animationType="slide" onRequestClose={() => setChatVisible(false)}>
            <TouchableOpacity style={dsm.chatOverlay} activeOpacity={1} onPress={() => setChatVisible(false)}>
                <TouchableOpacity activeOpacity={1}>
                <View style={[dsm.chatSheet, { backgroundColor: colors.card }]}>
                    <View style={[dsm.chatHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[dsm.chatTitle, { color: colors.text }]}>
                            Chat with {driver?.firstName ?? 'Driver'}
                        </Text>
                        <TouchableOpacity onPress={() => setChatVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={22} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Chat history */}
                    <ScrollView style={dsm.chatHistory} contentContainerStyle={{ paddingVertical: 12, gap: 8 }}>
                        {chatHistory.length === 0 && (
                            <Text style={[dsm.chatEmpty, { color: colors.subText }]}>No messages yet. Say hi!</Text>
                        )}
                        {chatHistory.map((msg, i) => (
                            <View key={i} style={[dsm.chatBubbleWrap, msg.from === 'rider' && { alignItems: 'flex-end' }]}>
                                <View style={[dsm.chatBubble, msg.from === 'rider'
                                    ? { backgroundColor: YELLOW }
                                    : { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }
                                ]}>
                                    <Text style={[dsm.chatBubbleTxt, { color: msg.from === 'rider' ? '#1A1A1A' : colors.text }]}>
                                        {msg.text}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Quick replies */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dsm.quickRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 4 }}>
                        {QUICK_REPLIES.map(qr => (
                            <TouchableOpacity key={qr} style={[dsm.quickChip, { backgroundColor: colors.bg, borderColor: YELLOW }]} onPress={() => sendMsg(qr)} activeOpacity={0.8}>
                                <Text style={[dsm.quickChipTxt, { color: colors.text }]}>{qr}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Text input row */}
                    <View style={[dsm.chatInputRow, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                        <TextInput
                            style={[dsm.chatInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                            placeholder="Type a message…"
                            placeholderTextColor={colors.subText}
                            value={chatMsg}
                            onChangeText={setChatMsg}
                            returnKeyType="send"
                            onSubmitEditing={() => sendMsg(chatMsg)}
                            multiline
                        />
                        <TouchableOpacity
                            style={[dsm.chatSendBtn, { backgroundColor: YELLOW, opacity: chatMsg.trim() ? 1 : 0.4 }]}
                            onPress={() => sendMsg(chatMsg)}
                            disabled={!chatMsg.trim()}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="send" size={18} color="#1A1A1A" />
                        </TouchableOpacity>
                    </View>
                </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>

        {/* ── CANCEL REASONS SHEET ── */}
        <Modal visible={cancelVisible} transparent animationType="slide" onRequestClose={() => setCancelVisible(false)}>
            <TouchableOpacity style={dsm.chatOverlay} activeOpacity={1} onPress={() => setCancelVisible(false)}>
                <TouchableOpacity activeOpacity={1}>
                <View style={[dsm.chatSheet, { backgroundColor: colors.card }]}>
                    <View style={[dsm.chatHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[dsm.chatTitle, { color: colors.text }]}>Why are you cancelling?</Text>
                        <TouchableOpacity onPress={() => setCancelVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={22} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
                        {CANCEL_REASONS.map(reason => (
                            <TouchableOpacity
                                key={reason}
                                style={[dsm.reasonRow, {
                                    borderColor: selectedReason === reason ? '#C62828' : colors.border,
                                    backgroundColor: selectedReason === reason ? '#FFEBEE' : colors.bg,
                                }]}
                                onPress={() => setSelectedReason(reason)}
                                activeOpacity={0.8}
                            >
                                <View style={[dsm.reasonRadio, {
                                    borderColor: selectedReason === reason ? '#C62828' : colors.border,
                                }]}>
                                    {selectedReason === reason && <View style={dsm.reasonRadioFill} />}
                                </View>
                                <Text style={[dsm.reasonTxt, { color: colors.text, fontWeight: selectedReason === reason ? '700' : '500' }]}>
                                    {reason}
                                </Text>
                            </TouchableOpacity>
                        ))}

                        {/* Other — freetext */}
                        {selectedReason === 'Other' && (
                            <TextInput
                                style={[dsm.chatInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text, marginTop: 4, minHeight: 72 }]}
                                placeholder="Tell us your reason…"
                                placeholderTextColor={colors.subText}
                                value={otherReason}
                                onChangeText={setOtherReason}
                                multiline
                                textAlignVertical="top"
                            />
                        )}

                        <TouchableOpacity
                            style={[dsm.confirmCancelBtn, { opacity: selectedReason ? 1 : 0.4 }]}
                            onPress={confirmCancel}
                            disabled={!selectedReason}
                            activeOpacity={0.85}
                        >
                            <Text style={dsm.confirmCancelTxt}>Confirm Cancellation</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => setCancelVisible(false)}>
                            <Text style={{ color: colors.subText, fontSize: 14 }}>Go Back</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>

        {/* ── SHARE TRIP — link + trusted contacts ── */}
        <Modal visible={shareVisible} transparent animationType="slide" onRequestClose={() => setShareVisible(false)}>
            <TouchableOpacity style={dsm.chatOverlay} activeOpacity={1} onPress={() => setShareVisible(false)}>
                <TouchableOpacity activeOpacity={1}>
                <View style={[dsm.chatSheet, { backgroundColor: colors.card }]}>
                    <View style={[dsm.chatHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[dsm.chatTitle, { color: colors.text }]}>Share Trip</Text>
                        <TouchableOpacity onPress={() => setShareVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={22} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>

                        {/* Trip details card */}
                        {driver && (
                            <View style={[dsm.shareTripCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                                {/* Driver row */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                    <View style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, { backgroundColor: driver.avatarColor }]}>
                                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>{driver.firstName[0]}{driver.lastName[0]}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[{ fontSize: 14, fontWeight: '700' }, { color: colors.text }]}>{driver.firstName} {driver.lastName}</Text>
                                        <Text style={[{ fontSize: 12 }, { color: colors.subText }]}>⭐ {driver.rating.toFixed(1)}  ·  {driver.trips.toLocaleString('en-IN')} trips</Text>
                                    </View>
                                    <View style={[dsm.verBadge, { backgroundColor: '#E8F5E9' }]}>
                                        <Ionicons name="shield-checkmark" size={11} color="#2E7D32" />
                                        <Text style={dsm.verTxt}>Verified</Text>
                                    </View>
                                </View>
                                {/* Vehicle row */}
                                <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1 }, { borderTopColor: colors.border }]}>
                                    <Ionicons name="car" size={14} color={colors.subText} />
                                    <Text style={[{ fontSize: 13, fontWeight: '600', flex: 1 }, { color: colors.text }]}>{driver.vehicleModel}  ·  {driver.vehicleColor}</Text>
                                    <Text style={[{ fontSize: 12, fontWeight: '700', letterSpacing: 1 }, { color: colors.text }]}>{driver.plate}</Text>
                                </View>
                                {/* Route */}
                                {(pickupLabel || destLabel) && (
                                    <View style={[{ paddingTop: 8, borderTopWidth: 1, gap: 4 }, { borderTopColor: colors.border }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="radio-button-on" size={12} color="#4CAF50" />
                                            <Text style={[{ fontSize: 12, flex: 1 }, { color: colors.text }]} numberOfLines={1}>{pickupLabel || '—'}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="location" size={12} color="#F44336" />
                                            <Text style={[{ fontSize: 12, flex: 1 }, { color: colors.text }]} numberOfLines={1}>{destLabel || '—'}</Text>
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Live tracking link */}
                        <Text style={[{ fontSize: 13, fontWeight: '700' }, { color: colors.text }]}>Live Trip Tracking Link</Text>
                        <View style={[dsm.shareLink, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                            <Ionicons name="link" size={16} color="#3949AB" style={{ marginRight: 8 }} />
                            <Text style={[dsm.shareLinkUrl, { color: '#3949AB' }]} numberOfLines={1}>
                                https://gaon.app/ride/{driver?.id ?? 'demo'}
                            </Text>
                            <TouchableOpacity
                                style={dsm.shareLinkCopyBtn}
                                onPress={() => Alert.alert('Copied!', 'Ride tracking link copied. Share it with your trusted contact.')}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="copy-outline" size={13} color="#fff" />
                                <Text style={dsm.shareLinkCopyTxt}>Copy</Text>
                            </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 11, color: colors.subText, marginTop: -4 }}>
                            Anyone with this link can track your live location, driver details, and vehicle info in real time.
                        </Text>

                        <Text style={[dsm.chatTitle, { color: colors.text, fontSize: 14, marginTop: 4 }]}>Send to Trusted Contacts</Text>

                        {trustedContacts.length === 0 ? (
                            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                                <Ionicons name="people-outline" size={40} color={colors.subText} />
                                <Text style={[dsm.chatEmpty, { color: colors.subText, marginTop: 10 }]}>No trusted contacts saved.</Text>
                                <Text style={[dsm.chatEmpty, { color: colors.subText, fontSize: 12 }]}>Add contacts in the Safety Hub.</Text>
                            </View>
                        ) : (
                            trustedContacts.map(c => (
                                <TouchableOpacity
                                    key={c.id}
                                    style={[dsm.reasonRow, {
                                        borderColor: selectedContacts.includes(c.id) ? '#1565C0' : colors.border,
                                        backgroundColor: selectedContacts.includes(c.id) ? '#E3F2FD' : colors.bg,
                                    }]}
                                    onPress={() => toggleContact(c.id)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[dsm.tcAvatar, { backgroundColor: YELLOW }]}>
                                        <Text style={dsm.tcAvatarTxt}>{c.name.charAt(0).toUpperCase()}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[dsm.reasonTxt, { color: colors.text }]}>{c.name}</Text>
                                        <Text style={{ fontSize: 12, color: colors.subText }}>{c.phone}</Text>
                                    </View>
                                    {/* Call round button */}
                                    <TouchableOpacity
                                        style={[dsm.tcRoundBtn, { backgroundColor: '#E8F5E9' }]}
                                        onPress={() => Alert.alert('Call', `Calling ${c.name} at ${c.phone}… (Demo)`)}
                                        activeOpacity={0.8}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Ionicons name="call" size={14} color="#2E7D32" />
                                    </TouchableOpacity>
                                    {/* Chat round button */}
                                    <TouchableOpacity
                                        style={[dsm.tcRoundBtn, { backgroundColor: '#E3F2FD', marginLeft: 6 }]}
                                        onPress={() => { setShareVisible(false); setTcChatContact(c); setTcChatHistory([]); setTcChatVisible(true); }}
                                        activeOpacity={0.8}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Ionicons name="chatbubble-ellipses" size={14} color="#1565C0" />
                                    </TouchableOpacity>
                                    {/* Selection checkbox */}
                                    <View style={[dsm.tcCheck, {
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
                                style={[dsm.confirmCancelBtn, { backgroundColor: '#1565C0', opacity: selectedContacts.length > 0 ? 1 : 0.4 }]}
                                onPress={shareTrip}
                                disabled={selectedContacts.length === 0}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="share-social" size={18} color="#fff" />
                                <Text style={[dsm.confirmCancelTxt, { color: '#fff' }]}>Share with {selectedContacts.length > 0 ? `${selectedContacts.length} contact${selectedContacts.length > 1 ? 's' : ''}` : 'contacts'}</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>

        {/* ── TRUSTED CONTACT CHAT ── */}
        <Modal visible={tcChatVisible} transparent animationType="slide" onRequestClose={() => setTcChatVisible(false)}>
            <TouchableOpacity style={dsm.chatOverlay} activeOpacity={1} onPress={() => setTcChatVisible(false)}>
                <TouchableOpacity activeOpacity={1}>
                <View style={[dsm.chatSheet, { backgroundColor: colors.card }]}>
                    <View style={[dsm.chatHeader, { borderBottomColor: colors.border }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={[dsm.chatTitle, { color: colors.text }]}>{tcChatContact?.name ?? 'Contact'}</Text>
                            <Text style={{ fontSize: 12, color: colors.subText }}>{tcChatContact?.phone}</Text>
                        </View>
                        <TouchableOpacity
                            style={[dsm.tcRoundBtn, { backgroundColor: '#E8F5E9', marginRight: 8 }]}
                            onPress={() => Alert.alert('Call', `Calling ${tcChatContact?.name} at ${tcChatContact?.phone}… (Demo)`)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="call" size={16} color="#2E7D32" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setTcChatVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={22} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={dsm.chatHistory} contentContainerStyle={{ paddingVertical: 12, gap: 8 }}>
                        {tcChatHistory.length === 0 && (
                            <Text style={[dsm.chatEmpty, { color: colors.subText }]}>
                                Share your ride link with {tcChatContact?.name}. Their replies appear here.
                            </Text>
                        )}
                        {tcChatHistory.map((msg, i) => (
                            <View key={i} style={[dsm.chatBubbleWrap, msg.from === 'me' && { alignItems: 'flex-end' }]}>
                                <View style={[dsm.chatBubble, msg.from === 'me'
                                    ? { backgroundColor: YELLOW }
                                    : { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }
                                ]}>
                                    <Text style={[dsm.chatBubbleTxt, { color: msg.from === 'me' ? '#1A1A1A' : colors.text }]}>
                                        {msg.text}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    <View style={[dsm.chatInputRow, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                        <TextInput
                            style={[dsm.chatInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                            placeholder="Type a message…"
                            placeholderTextColor={colors.subText}
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
                            style={[dsm.chatSendBtn, { backgroundColor: YELLOW, opacity: tcChatMsg.trim() ? 1 : 0.4 }]}
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

function InfoChip({ icon, label, value, colors, highlight }: { icon: string; label: string; value: string; colors: any; highlight?: boolean }) {
    return (
        <View style={[dsm.infoChip, { backgroundColor: highlight ? '#FFF8E1' : colors.card, borderColor: highlight ? '#FFC82C' : colors.border }]}>
            <Ionicons name={icon as any} size={14} color={highlight ? '#E65100' : colors.subText} />
            <View>
                <Text style={[dsm.chipLabel, { color: colors.subText }]}>{label}</Text>
                <Text style={[dsm.chipValue, { color: highlight ? '#E65100' : colors.text, fontWeight: highlight ? '800' : '600' }]}>{value}</Text>
            </View>
        </View>
    );
}

const dsm = StyleSheet.create({
    overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet:          { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, maxHeight: '90%', overflow: 'hidden' },
    phaseWrap:      { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24, gap: 12 },
    phaseTitle:     { fontSize: 20, fontWeight: '800', marginTop: 8 },
    phaseSub:       { fontSize: 14, textAlign: 'center' },
    dotRow:         { flexDirection: 'row', gap: 8, marginTop: 8 },
    dotStep:        { width: 10, height: 10, borderRadius: 5 },
    cancelBtn:      { marginTop: 12, paddingHorizontal: 28, paddingVertical: 11, borderRadius: 22, borderWidth: 1.5 },
    cancelTxt:      { fontSize: 14, fontWeight: '600' },
    miniCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12, width: '100%' },
    miniName:       { fontSize: 15, fontWeight: '700', marginBottom: 3 },
    driverSection:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 16, marginBottom: 10, paddingBottom: 14, borderBottomWidth: 1 },
    driverCard:     { marginHorizontal: 16, marginTop: 10, borderRadius: 14, padding: 14, borderWidth: 1 },
    driverTop:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    driverName:     { fontSize: 17, fontWeight: '800', marginBottom: 4 },
    driverMeta:     { fontSize: 12, marginTop: 4, lineHeight: 18 },
    trips:          { fontSize: 12, marginTop: 2 },
    verBadge:       { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 12 },
    verTxt:         { fontSize: 10, fontWeight: '700', color: '#2E7D32' },
    cardDivider:    { height: 1, marginVertical: 8 },
    infoGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    infoChip:       { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, width: '47%' },
    chipLabel:      { fontSize: 10, fontWeight: '500' },
    chipValue:      { fontSize: 12 },
    safetyRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 4 },
    safetyTxt:      { fontSize: 11, flex: 1, lineHeight: 16 },
    actionRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
    actionBtn:      { width: '47.5%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20, borderRadius: 16 },
    actionBtnTxt:   { fontSize: 14, fontWeight: '700' },
    avatarCircle:   { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    avatarLg:       { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
    avatarTxt:      { fontSize: 16, fontWeight: '800', color: '#fff' },
    avatarTxtLg:    { fontSize: 20, fontWeight: '900', color: '#fff' },
    paxCountRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 10 },
    paxCountTxt:    { fontSize: 13, fontWeight: '600' },
    mapNoteRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 12, marginTop: 4, marginBottom: 2 },
    mapNoteTxt:     { fontSize: 11, flex: 1 },
    // Accepted phase top bar
    acceptedTopBar:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
    sheetHandle:      { width: 40, height: 4, borderRadius: 2 },
    minimizeBtn:      { padding: 8, borderRadius: 20 },
    // Accepted banner
    bannerCheckCircle:{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    acceptedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2E7D32', paddingHorizontal: 20, paddingVertical: 16 },
    acceptedTitle:  { fontSize: 17, fontWeight: '900', color: '#fff' },
    acceptedVehicle:{ fontSize: 15, fontWeight: '900', color: '#fff', marginTop: 2 },
    acceptedSub:    { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    etaBadge:       { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
    etaBadgeNum:    { fontSize: 24, fontWeight: '900', color: '#fff' },
    etaBadgeLbl:    { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: -1 },
    // Request sent banner
    requestBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 4 },
    requestBannerTxt: { fontSize: 13, fontWeight: '600' },
    // Countdown
    countdownWrap:  { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FFC82C', alignItems: 'center', justifyContent: 'center', marginVertical: 6 },
    countdownNum:   { fontSize: 28, fontWeight: '900', color: '#E65100' },
    countdownLabel: { fontSize: 10, fontWeight: '600', marginTop: -2 },
    // OTP
    otpCard:        { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
    otpIconWrap:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center' },
    otpLabel:       { fontSize: 11, fontWeight: '500', marginBottom: 3 },
    otpCode:        { fontSize: 30, fontWeight: '900', letterSpacing: 10 },
    // Chat sheet
    chatOverlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
    chatSheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' },
    chatHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    chatTitle:      { fontSize: 17, fontWeight: '800' },
    chatHistory:    { maxHeight: 220, paddingHorizontal: 16 },
    chatEmpty:      { textAlign: 'center', fontSize: 14 },
    chatBubbleWrap: { marginBottom: 6 },
    chatBubble:     { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
    chatBubbleTxt:  { fontSize: 14 },
    quickRow:       { height: 52, marginVertical: 6 },
    quickChip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
    quickChipTxt:   { fontSize: 13, fontWeight: '600' },
    // Fellow travellers badge (accepted phase)
    ftBadgeRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1.5, padding: 12 },
    ftBadgeIcon:    { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(21,101,192,0.12)', alignItems: 'center', justifyContent: 'center' },
    ftBadgeTxt:     { flex: 1, fontSize: 13, fontWeight: '600' },
    ftCountBubble:  { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    ftCountBubbleTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },
    // Share trip card
    shareTripCard:  { borderRadius: 14, borderWidth: 1, padding: 14 },
    chatInputRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1 },
    chatInput:      { flex: 1, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
    chatSendBtn:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    // Cancel reasons
    reasonRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1.5, borderRadius: 14 },
    reasonRadio:    { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    reasonRadioFill:{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#C62828' },
    reasonTxt:      { flex: 1, fontSize: 14 },
    confirmCancelBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#C62828', borderRadius: 14, paddingVertical: 15, marginTop: 8 },
    confirmCancelTxt:{ fontSize: 15, fontWeight: '800', color: '#fff' },
    // Trusted contact picker
    tcAvatar:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    tcAvatarTxt:    { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
    tcCheck:        { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    tcRoundBtn:     { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    // Step indicator
    stepRow:        { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
    stepDot:        { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    stepDotTxt:     { fontSize: 10, fontWeight: '800', color: '#fff' },
    stepLbl:        { fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center' },
    stepLine:       { height: 2, marginTop: 11 },
    // Pre-boarding checklist
    nextStepsCard:  { marginHorizontal: 16, marginTop: 10, borderRadius: 14, borderWidth: 1, padding: 14 },
    nextStepsTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10 },
    nextStepRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
    nextStepIcon:   { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    nextStepTxt:    { flex: 1, fontSize: 13, fontWeight: '500' },
    // Share trip link
    shareLink:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12 },
    shareLinkUrl:   { flex: 1, fontSize: 12, fontWeight: '600' },
    shareLinkCopyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3949AB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
    shareLinkCopyTxt: { fontSize: 11, fontWeight: '700', color: '#fff' },
});

// ─── Booking Screen ───────────────────────────────────────────────────────────
export default function BookingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        rideType: string; pickup: string; service?: string;
        pickupLat?: string; pickupLng?: string;
        destination?: string; destLat?: string; destLng?: string;
        tripType?: string; passengerCount?: string;
        scheduledAt?: string; returnAt?: string;
        extraPickups?: string;
    }>();
    const { colors, isDark, language } = useAppSettings();
    const { addNotification } = useNotifications();
    const lang = language.code;
    const s = makeStyles(colors);
    const mapRef = useRef<MapView>(null);

    // ── Trip / group params ───────────────────────────────────────────────────
    const tripType       = (params.tripType ?? 'one_way') as 'one_way' | 'round_trip' | 'schedule';
    const passengerCount = Math.max(1, parseInt(params.passengerCount ?? '1', 10) || 1);
    const scheduledAt    = params.scheduledAt ? new Date(params.scheduledAt) : null;
    const returnAt       = params.returnAt    ? new Date(params.returnAt)    : null;
    const extraPickupPoints: Array<{ label: string; lat: number; lng: number }> = (() => {
        try { return JSON.parse(params.extraPickups ?? '[]'); } catch { return []; }
    })();
    const fmtDate = (d: Date) =>
        d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' +
        d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    const rideType = params.rideType ?? '1';
    const meta     = RIDE_META[rideType];
    const service  = params.service ?? '';
    const screenTitle = service ? service : meta ? t(meta.key as any, lang) : t('book_now', lang);

    // Pickup state
    const [pickupLabel,  setPickupLabel]  = useState(params.pickup ?? '');
    const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(
        params.pickupLat && params.pickupLng
            ? { lat: parseFloat(params.pickupLat), lng: parseFloat(params.pickupLng) }
            : null,
    );

    // Destination state
    const [destLabel,  setDestLabel]  = useState(params.destination ?? '');
    const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(
        params.destLat && params.destLng
            ? { lat: parseFloat(params.destLat), lng: parseFloat(params.destLng) }
            : null,
    );

    // Route state
    const [routePolyline, setRoutePolyline]     = useState<{ latitude: number; longitude: number }[]>([]);
    const [dynamicEta,    setDynamicEta]         = useState<string | null>(null);
    const [dynamicFare,   setDynamicFare]        = useState<string | null>(null);
    const [distanceText,  setDistanceText]       = useState<string | null>(null);
    const [isCalcRoute,   setIsCalcRoute]        = useState(false);
    const [isBooking,     setIsBooking]          = useState(false);

    // Pay modal — shown after ride is confirmed
    const [payModal, setPayModal]   = useState<{ visible: boolean; savedRideId: string; fare: string } | null>(null);
    const [payingNow, setPayingNow] = useState(false);

    const { setActiveRide } = useActiveRide();
    // ── Driver search / acceptance flow ──────────────────────────────────────
    const [driverSearchPhase, setDriverSearchPhase] = useState<'idle' | 'searching' | 'accepting' | 'accepted'>('idle');
    const [foundDriver,       setFoundDriver]        = useState<DriverInfo | null>(null);
    const [driverMarkerCoord, setDriverMarkerCoord]  = useState<{ latitude: number; longitude: number } | null>(null);
    const searchTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

    // ── 15-second countdown state (shown while waiting for driver) ────────────
    const [countdown, setCountdown]       = useState(0);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopCountdown = useCallback(() => {
        if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    }, []);

    const startCountdown = useCallback((seconds: number, onExpire: () => void) => {
        stopCountdown();
        setCountdown(seconds);
        countdownRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    stopCountdown();
                    onExpire();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [stopCountdown]);

    const clearSearchTimers = useCallback(() => {
        searchTimers.current.forEach(clearTimeout);
        searchTimers.current = [];
        stopCountdown();
    }, [stopCountdown]);

    const startDriverSearch = useCallback(async (preSelectedDriver?: DriverInfo) => {
        if (!destLabel.trim()) { Alert.alert('Destination missing', 'Please enter your destination.'); return; }
        clearSearchTimers();

        if (preSelectedDriver) {
            // ── Pre-selected driver path ──────────────────────────────────────
            // Show the request + countdown immediately — no backend wait
            setFoundDriver(preSelectedDriver);
            setDriverSearchPhase('accepting');
            startCountdown(30, () => {
                setDriverSearchPhase('accepted');
                setActiveRide(preSelectedDriver);
                if (pickupCoords) {
                    const angle  = Math.random() * 2 * Math.PI;
                    const offset = 0.003 + Math.random() * 0.008;
                    setDriverMarkerCoord({
                        latitude:  pickupCoords.lat + offset * Math.cos(angle),
                        longitude: pickupCoords.lng + offset * Math.sin(angle),
                    });
                }
                addNotification({
                    category: 'ride', title: 'Driver Accepted! 🎉',
                    body: `${preSelectedDriver.firstName} ${preSelectedDriver.lastName} (${preSelectedDriver.vehicleModel}, ${preSelectedDriver.plate}) is on the way. ETA: ${preSelectedDriver.etaToPickup} min`,
                    actionRoute: '/notifications',
                });
            });
            // Save to backend silently in background
            setIsBooking(true);
            try {
                const rideData = {
                    userId: 'user-001',
                    rideType: meta?.key || 'private_car',
                    date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                    pickup: pickupLabel, dropoff: destLabel,
                    fare: dynamicFare || meta?.fare || '₹100',
                    duration: dynamicEta || meta?.eta || '10 min',
                    rating: 5, paymentMethod: 'cash', paymentStatus: 'pending',
                    tripType, passengerCount,
                    scheduledAt: scheduledAt?.toISOString() ?? null,
                    returnAt: returnAt?.toISOString() ?? null,
                    extraPickupPoints,
                };
                const savedRide = await bookRide(rideData);
                setIsBooking(false);
                if (savedRide?._id) {
                    setPayModal({ visible: false, savedRideId: savedRide._id, fare: dynamicFare || meta?.fare || '₹100' });
                }
            } catch {
                setIsBooking(false);
                // Backend error — countdown still running, don't cancel the ride UI
            }
            return;
        }

        // ── Random search path ────────────────────────────────────────────────
        setDriverSearchPhase('searching');
        setIsBooking(true);
        try {
            const rideData = {
                userId: 'user-001',
                rideType: meta?.key || 'private_car',
                date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                pickup: pickupLabel, dropoff: destLabel,
                fare: dynamicFare || meta?.fare || '₹100',
                duration: dynamicEta || meta?.eta || '10 min',
                rating: 5, paymentMethod: 'cash', paymentStatus: 'pending',
                tripType, passengerCount,
                scheduledAt: scheduledAt?.toISOString() ?? null,
                returnAt: returnAt?.toISOString() ?? null,
                extraPickupPoints,
            };
            const savedRide = await bookRide(rideData);
            setIsBooking(false);
            addNotification({
                category: 'ride', title: 'Looking for drivers…',
                body: `Searching for a ${screenTitle} near ${pickupLabel}`,
                actionRoute: '/notifications',
            });
            const acceptDriver = (driver: DriverInfo) => {
                setFoundDriver(driver);
                setDriverSearchPhase('accepting');
                startCountdown(30, () => {
                    setDriverSearchPhase('accepted');
                    setActiveRide(driver);
                    if (pickupCoords) {
                        const angle  = Math.random() * 2 * Math.PI;
                        const offset = 0.003 + Math.random() * 0.008;
                        setDriverMarkerCoord({
                            latitude:  pickupCoords.lat + offset * Math.cos(angle),
                            longitude: pickupCoords.lng + offset * Math.sin(angle),
                        });
                    }
                    addNotification({
                        category: 'ride', title: 'Driver Accepted! 🎉',
                        body: `${driver.firstName} ${driver.lastName} (${driver.vehicleModel}, ${driver.plate}) is on the way. ETA: ${driver.etaToPickup} min`,
                        actionRoute: '/notifications',
                    });
                    if (savedRide?._id) {
                        setPayModal({ visible: false, savedRideId: savedRide._id, fare: dynamicFare || meta?.fare || '₹100' });
                    }
                });
            };
            // Simulate finding a nearby driver after 3s
            const t1 = setTimeout(() => {
                acceptDriver(generateDriver(rideType, pickupLabel));
            }, 3000);
            searchTimers.current.push(t1);
        } catch (err: any) {
            setIsBooking(false);
            setDriverSearchPhase('idle');
            Alert.alert('Error', err.message || 'Could not book ride. Please check your internet connection.');
        }
    }, [destLabel, pickupLabel, pickupCoords, rideType, meta, dynamicFare, dynamicEta, tripType, passengerCount, scheduledAt, returnAt, extraPickupPoints, screenTitle, addNotification, clearSearchTimers, startCountdown]);

    const cancelDriverSearch = useCallback(() => {
        clearSearchTimers();
        setDriverSearchPhase('idle');
        setFoundDriver(null);
        setDriverMarkerCoord(null);
        setActiveRide(null);
    }, [clearSearchTimers, setActiveRide]);

    // ── Nearby vehicles (simulated) ───────────────────────────────────────────
    // selectedNearbyVehicle state removed — vehicle tap now directly calls startDriverSearch
    const nearbyVehicles = useMemo<DriverInfo[]>(() => {
        if (!pickupLabel || !destLabel) return [];
        const seed = pickupLabel + rideType;
        return Array.from({ length: 4 }, (_, i) => generateDriver(rideType, seed + i));
    }, [pickupLabel, destLabel, rideType]);

    // Search modal
    const [searchModal, setSearchModal] = useState<{ mode: 'pickup' | 'destination'; initialValue: string } | null>(null);
    // Map picker
    const [mapPicker, setMapPicker]     = useState<{ mode: 'pickup' | 'destination' } | null>(null);

    // ── Fetch directions whenever pickup & dest coords exist ──────────────────
    useEffect(() => {
        if (!pickupCoords || !destCoords) return;
        (async () => {
            setIsCalcRoute(true);
            try {
                const dir = await fetchDirections(
                    { lat: pickupCoords.lat, lng: pickupCoords.lng },
                    { lat: destCoords.lat,   lng: destCoords.lng   },
                );
                if (dir) {
                    setDynamicEta(dir.durationText);
                    setDistanceText(dir.distanceText);
                    const fare = calculateDynamicFare(meta?.baseFare ?? 30, meta?.perKm ?? 14, dir.distanceValue);
                    setDynamicFare(fare);
                    const pts = decodePolyline(dir.polylineEncoded);
                    setRoutePolyline(pts);
                    // Fit map to route
                    mapRef.current?.fitToCoordinates(pts, { edgePadding: { top: 60, right: 40, bottom: 60, left: 40 }, animated: true });
                }
            } finally { setIsCalcRoute(false); }
        })();
    }, [pickupCoords, destCoords]);

    const handlePickupSelect = (d: PlaceDetail) => {
        setPickupLabel(d.formattedAddress);
        setPickupCoords({ lat: d.lat, lng: d.lng });
        setSearchModal(null);
    };

    const handleDestSelect = (d: PlaceDetail) => {
        setDestLabel(d.formattedAddress);
        setDestCoords({ lat: d.lat, lng: d.lng });
        setSearchModal(null);
    };

    const handleConfirm = async () => {
        if (!destLabel.trim()) { Alert.alert('Destination missing', 'Please enter your destination.'); return; }
        setIsBooking(true);
        try {
            const rideData = {
                userId: 'user-001',
                rideType: meta?.key || 'private_car',
                date: new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                pickup: pickupLabel,
                dropoff: destLabel,
                fare: dynamicFare || meta?.fare || '₹100',
                duration: dynamicEta || meta?.eta || '10 min',
                rating: 5,
                paymentMethod: 'cash',
                paymentStatus: 'pending',
                tripType,
                passengerCount,
                scheduledAt: scheduledAt?.toISOString() ?? null,
                returnAt: returnAt?.toISOString() ?? null,
                extraPickupPoints,
            };
            const savedRide = await bookRide(rideData);
            setIsBooking(false);
            addNotification({
                category: 'ride',
                title: 'Ride Confirmed!',
                body: `Your ${screenTitle} from ${pickupLabel} to ${destLabel} has been booked. Fare: ${dynamicFare || meta?.fare || '₹100'}`,
                actionRoute: '/notifications',
            });
            setPayModal({
                visible: true,
                savedRideId: savedRide?._id ?? '',
                fare: dynamicFare || meta?.fare || '₹100',
            });
        } catch (err: any) {
            setIsBooking(false);
            console.error('[handleConfirm] Booking error:', err?.message ?? err);
            Alert.alert('Booking Failed', err?.message || 'There was an error booking your ride. Please try again.');
        }
    };

    const handlePayNow = async () => {
        if (!payModal) return;
        setPayingNow(true);
        try {
            const fareNum = parseInt(payModal.fare.replace(/[^0-9]/g, '') || '100');
            const order = await createPaymentOrder(fareNum, payModal.savedRideId);

            // ── TODO: After running  npx expo install react-native-razorpay && npx expo run:ios
            // Replace the Alert below with:
            //
            // const RazorpayCheckout = require('react-native-razorpay').default;
            // const payment = await RazorpayCheckout.open({
            //   description: 'Gaon Ride Payment',
            //   currency: 'INR',
            //   key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID,
            //   amount: order.amount,
            //   order_id: order.id,
            //   name: 'Gaon Ride',
            //   prefill: { name: 'User', email: '', contact: '' },
            //   theme: { color: '#FFC82C' },
            // });
            // await verifyPayment({ ...payment, rideId: payModal.savedRideId });
            // setPayModal(null);
            // Alert.alert('Payment Successful!', `Paid ${payModal.fare} via Razorpay.`, [{ text: 'Done', onPress: () => router.back() }]);
            // ────────────────────────────────────────────────────────────────────

            // Placeholder until react-native-razorpay is installed
            Alert.alert(
                'Razorpay Order Created ✓',
                `Server order ready (ID: ${order?.id?.slice(-8) ?? 'N/A'})\n\nTo open checkout:\n1. npx expo install react-native-razorpay\n2. npx expo run:ios\n3. Uncomment RazorpayCheckout lines in handlePayNow`,
                [{ text: 'OK' }],
            );
        } catch (err: any) {
            Alert.alert('Payment Error', err?.message || 'Could not initiate payment.');
        } finally { setPayingNow(false); }
    };

    const handlePayLater = () => {
        addNotification({
            category: 'payment',
            title: 'Pay on delivery',
            body: `Cash payment of ${payModal?.fare ?? ''} will be collected at the end of your ride.`,
            actionRoute: '/payment',
        });
        setPayModal(null);
        router.back();
    };

    const hasRoute = pickupCoords && destCoords;

    return (
        <SafeAreaView style={s.root} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={YELLOW} />

            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={s.headerTitle}>{screenTitle}</Text>
                <View style={{ width: 38 }} />
            </View>

            {/* ── GOOGLE MAP ── */}
            <View style={s.mapWrap}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={StyleSheet.absoluteFillObject}
                    showsTraffic
                    showsUserLocation
                    showsMyLocationButton={false}
                    showsCompass={false}
                    initialRegion={
                        pickupCoords
                            ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
                            : { ...INDIA_FALLBACK, latitudeDelta: 0.1, longitudeDelta: 0.1 }
                    }
                >
                    {/* Pickup marker */}
                    {pickupCoords && (
                        <Marker coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
                            <View style={s.markerWrap}>
                                <View style={[s.markerCircle, { backgroundColor: '#4CAF50' }]}>
                                    <Ionicons name="radio-button-on" size={13} color="#fff" />
                                </View>
                                <View style={[s.markerTail, { backgroundColor: '#4CAF50' }]} />
                            </View>
                        </Marker>
                    )}
                    {/* Destination marker */}
                    {destCoords && (
                        <Marker coordinate={{ latitude: destCoords.lat, longitude: destCoords.lng }} anchor={{ x: 0.5, y: 1 }}>
                            <View style={s.markerWrap}>
                                <View style={[s.markerCircle, { backgroundColor: '#F44336' }]}>
                                    <Ionicons name="location" size={13} color="#fff" />
                                </View>
                                <View style={[s.markerTail, { backgroundColor: '#F44336' }]} />
                            </View>
                        </Marker>
                    )}
                    {/* Extra pickup stop markers — group from different villages */}
                    {extraPickupPoints.map((ep, idx) => (
                        <Marker key={`ep-${idx}`} coordinate={{ latitude: ep.lat, longitude: ep.lng }} anchor={{ x: 0.5, y: 1 }}>
                            <View style={s.markerWrap}>
                                <View style={[s.markerCircle, { backgroundColor: '#FF6B00' }]}>
                                    <Ionicons name="people" size={11} color="#fff" />
                                </View>
                                <View style={[s.markerTail, { backgroundColor: '#FF6B00' }]} />
                            </View>
                        </Marker>
                    ))}
                    {/* Route polyline */}
                    {routePolyline.length > 0 && (
                        <Polyline
                            coordinates={routePolyline}
                            strokeWidth={4}
                            strokeColor={meta?.color ?? YELLOW}
                        />
                    )}
                    {/* Driver marker — shown after acceptance */}
                    {driverMarkerCoord && foundDriver && (
                        <Marker coordinate={driverMarkerCoord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                            <View style={s.driverMarker}>
                                <MaterialCommunityIcons name={meta?.icon as any ?? 'car'} size={18} color="#fff" />
                            </View>
                        </Marker>
                    )}
                </MapView>
                {isCalcRoute && (
                    <View style={s.mapLoader}>
                        <ActivityIndicator size="small" color={YELLOW} />
                        <Text style={s.mapLoaderTxt}>Calculating route…</Text>
                    </View>
                )}
                {/* Floating SOS button on map */}
                <TouchableOpacity
                    style={s.sosFloatBtn}
                    onPress={() => Alert.alert(
                        '🚨 Emergency SOS',
                        'This will call 112 (National Emergency — Police / Ambulance / Fire).',
                        [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Call 112 NOW', style: 'destructive', onPress: () => Linking.openURL('tel:112') },
                        ]
                    )}
                    activeOpacity={0.85}
                >
                    <Text style={s.sosFloatTxt}>SOS</Text>
                </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>

                {/* Ride type pill */}
                {!!meta && (
                    <View style={[s.ridePill, { borderColor: meta.color + '40', backgroundColor: meta.color + '10' }]}>
                        <RideIcon meta={meta} />
                        <View style={s.pillText}>
                            <Text style={s.pillTitle}>{t(meta.key as any, lang)}</Text>
                            <Text style={s.pillSub}>{t('eta', lang)} {dynamicEta || meta.eta} · {dynamicFare || meta.fare}</Text>
                        </View>
                    </View>
                )}

                {/* Trip / Group / Schedule badges */}
                {(tripType !== 'one_way' || passengerCount > 1 || scheduledAt || returnAt) && (
                    <View style={s.tripBadgeRow}>
                        {tripType === 'round_trip' && (
                            <View style={[s.tripBadge, { backgroundColor: '#E8F5E9' }]}>
                                <Ionicons name="swap-horizontal-outline" size={13} color="#2E7D32" />
                                <Text style={[s.tripBadgeTxt, { color: '#2E7D32' }]}>Round Trip</Text>
                            </View>
                        )}
                        {(tripType === 'schedule' || tripType === 'round_trip') && scheduledAt && (
                            <View style={[s.tripBadge, { backgroundColor: '#FFF3E0' }]}>
                                <Ionicons name="time-outline" size={13} color="#E65100" />
                                <Text style={[s.tripBadgeTxt, { color: '#E65100' }]}>{fmtDate(scheduledAt)}</Text>
                            </View>
                        )}
                        {returnAt && (
                            <View style={[s.tripBadge, { backgroundColor: '#E8F5E9' }]}>
                                <Ionicons name="return-up-back-outline" size={13} color="#2E7D32" />
                                <Text style={[s.tripBadgeTxt, { color: '#2E7D32' }]}>Return: {fmtDate(returnAt)}</Text>
                            </View>
                        )}
                        {passengerCount > 1 && (
                            <View style={[s.tripBadge, { backgroundColor: '#E3F2FD' }]}>
                                <Ionicons name="people-outline" size={13} color="#1565C0" />
                                <Text style={[s.tripBadgeTxt, { color: '#1565C0' }]}>{passengerCount} Passengers</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Route card */}
                <View style={s.routeCard}>
                    {/* Pickup */}
                    <TouchableOpacity
                        style={s.routeRow}
                        onPress={() => setSearchModal({ mode: 'pickup', initialValue: pickupLabel })}
                        activeOpacity={0.8}
                    >
                        <View style={s.dotGreen} />
                        <View style={s.routeInputWrap}>
                            <Text style={s.routeLabel}>{t('pickup', lang)}</Text>
                            <Text style={[s.routeValue, { color: pickupLabel ? colors.text : colors.subText }]} numberOfLines={1}>
                                {pickupLabel || 'Set pickup location'}
                            </Text>
                        </View>
                        <Ionicons name="pencil" size={14} color={colors.subText} />
                    </TouchableOpacity>
                    {/* Extra pickup stops (group from different villages) */}
                    {extraPickupPoints.map((ep, idx) => (
                        <React.Fragment key={`ep-route-${idx}`}>
                            <View style={s.routeDivider} />
                            <View style={s.routeRow}>
                                <View style={[s.dotOrange]} />
                                <View style={s.routeInputWrap}>
                                    <Text style={s.routeLabel}>Stop {idx + 2} (Group Pickup)</Text>
                                    <Text style={[s.routeValue, { color: colors.text }]} numberOfLines={1}>{ep.label}</Text>
                                </View>
                            </View>
                        </React.Fragment>
                    ))}
                    <View style={s.routeDivider} />
                    {/* Destination */}
                    <TouchableOpacity
                        style={s.routeRow}
                        onPress={() => setSearchModal({ mode: 'destination', initialValue: destLabel })}
                        activeOpacity={0.8}
                    >
                        <View style={s.dotRed} />
                        <View style={s.routeInputWrap}>
                            <Text style={s.routeLabel}>{t('drop', lang)}</Text>
                            <Text style={[s.routeValue, { color: destLabel ? colors.text : colors.subText }]} numberOfLines={1}>
                                {destLabel || 'Search destination…'}
                            </Text>
                        </View>
                        <Ionicons name="pencil" size={14} color={colors.subText} />
                    </TouchableOpacity>
                </View>

                {/* ── Fellow Travelers — co-passenger safety card ── */}
                <FellowTravelersCard
                    pickup={pickupLabel}
                    dest={destLabel}
                    myPassengerCount={passengerCount}
                    rideType={rideType}
                    s={s}
                    colors={colors}
                />

                {/* ── Nearby Vehicles Sheet ── */}
                {nearbyVehicles.length > 0 && driverSearchPhase === 'idle' && (
                    <View style={[s.fareCard, { marginTop: 10 }]}>
                        <Text style={[s.fareLabel, { fontSize: 13, fontWeight: '700', marginBottom: 8, color: colors.text }]}>
                            Nearby available vehicles
                        </Text>
                        {nearbyVehicles.map((v, i) => (
                            <TouchableOpacity
                                key={i}
                                activeOpacity={0.8}
                                onPress={() => startDriverSearch(v)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12, marginBottom: 4 }}
                            >
                                <View style={[{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, { backgroundColor: v.avatarColor }]}>
                                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#fff' }}>{v.firstName[0]}{v.lastName[0]}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{v.firstName} {v.lastName}</Text>
                                    <Text style={{ fontSize: 12, color: colors.subText }}>{v.vehicleModel} · {v.plate}</Text>
                                    <StarRow rating={v.rating} />
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: meta?.color ?? YELLOW }}>{v.etaToPickup} min away</Text>
                                    <Text style={{ fontSize: 11, color: colors.subText }}>{dynamicFare || meta?.fare || ''}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* Fare card */}
                {hasRoute && meta && (
                    <View style={s.fareCard}>
                        {isCalcRoute ? (
                            <View style={{ paddingVertical: 18, alignItems: 'center', gap: 8 }}>
                                <ActivityIndicator size="small" color={YELLOW} />
                                <Text style={{ color: colors.subText, fontSize: 12 }}>Calculating route & fare…</Text>
                            </View>
                        ) : (
                            <>
                                <View style={s.fareRow}>
                                    <Text style={s.fareLabel}>{t('estimated_fare', lang)}</Text>
                                    <Text style={[s.fareValue, { color: meta.color }]}>{dynamicFare || meta.fare}</Text>
                                </View>
                                {passengerCount > 1 && (dynamicFare || meta.fare) && (
                                    <View style={s.fareRow}>
                                        <Text style={s.fareLabel}>👥 Per Person ({passengerCount} pax)</Text>
                                        <Text style={[s.fareValue, { color: '#1565C0' }]}>
                                            {'₹' + Math.ceil(parseFloat((dynamicFare || meta.fare).replace(/[^0-9.]/g, '') || '0') / passengerCount)}
                                        </Text>
                                    </View>
                                )}
                                {scheduledAt && (
                                    <View style={s.fareRow}>
                                        <Text style={s.fareLabel}>📅 Departure</Text>
                                        <Text style={s.fareValue}>{fmtDate(scheduledAt)}</Text>
                                    </View>
                                )}
                                {returnAt && (
                                    <View style={s.fareRow}>
                                        <Text style={s.fareLabel}>↩️ Return</Text>
                                        <Text style={s.fareValue}>{fmtDate(returnAt)}</Text>
                                    </View>
                                )}
                                {distanceText && (
                                    <View style={s.fareRow}>
                                        <Text style={s.fareLabel}>Distance</Text>
                                        <Text style={s.fareValue}>{distanceText}</Text>
                                    </View>
                                )}
                                <View style={s.fareRow}>
                                    <Text style={s.fareLabel}>{t('eta', lang)}</Text>
                                    <Text style={s.fareValue}>{dynamicEta || meta.eta}</Text>
                                </View>
                                <View style={s.fareRow}>
                                    <Text style={s.fareLabel}>{t('payment', lang)}</Text>
                                    <View style={s.payRow}>
                                        <Ionicons name="cash-outline" size={16} color={colors.text} />
                                        <Text style={s.fareValue}>{t('cash', lang)}</Text>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* ── Find Driver / Action button ── */}
            <View style={s.confirmWrap}>
                {driverSearchPhase === 'idle' ? null : driverSearchPhase === 'accepted' ? (
                    <View style={{ gap: 8 }}>
                        {/* Start Trip — navigate to live tracking */}
                        <TouchableOpacity
                            style={[s.confirmBtn, { backgroundColor: YELLOW }]}
                            onPress={() => { setActiveRide(null); router.push({
                                pathname: '/live-trip',
                                params: {
                                    rideType:    rideType,
                                    driverName:  foundDriver ? `${foundDriver.firstName} ${foundDriver.lastName}` : '',
                                    driverPlate: foundDriver?.plate ?? '',
                                    driverModel: foundDriver?.vehicleModel ?? '',
                                    pickupLat:   pickupCoords?.lat?.toString() ?? '',
                                    pickupLng:   pickupCoords?.lng?.toString() ?? '',
                                    destLat:     destCoords?.lat?.toString() ?? '',
                                    destLng:     destCoords?.lng?.toString() ?? '',
                                    pickup:      pickupLabel,
                                    destination: destLabel,
                                    fare:        dynamicFare || meta?.fare || '',
                                    etaMin:      foundDriver?.etaToPickup?.toString() ?? '',
                                },
                            }); }}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="navigate" size={20} color="#1A1A1A" />
                            <Text style={s.confirmText}>Start Trip & Track</Text>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                style={[s.confirmBtn, { flex: 1, backgroundColor: '#FF4444' }]}
                                onPress={() => { cancelDriverSearch(); Alert.alert('Ride Cancelled', 'Your ride has been cancelled.'); }}
                            >
                                <Ionicons name="close-circle-outline" size={20} color="#fff" />
                                <Text style={[s.confirmText, { color: '#fff' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[s.confirmBtn, { flex: 2, backgroundColor: '#2E7D32' }]}
                                onPress={() => setPayModal(prev => prev ? { ...prev, visible: true } : null)}
                            >
                                <Ionicons name="cash-outline" size={20} color="#fff" />
                                <Text style={[s.confirmText, { color: '#fff' }]}>Pay Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}
            </View>

            {/* Search modal */}
            {searchModal && (
                <LocationSearchModal
                    visible
                    mode={searchModal.mode}
                    initialValue={searchModal.initialValue}
                    colors={colors}
                    onSelect={searchModal.mode === 'pickup' ? handlePickupSelect : handleDestSelect}
                    onPickOnMap={() => {
                        setSearchModal(null);
                        setMapPicker({ mode: searchModal.mode });
                    }}
                    onClose={() => setSearchModal(null)}
                />
            )}

            {/* Map picker */}
            {mapPicker && (
                <MapPickerModal
                    visible
                    mode={mapPicker.mode}
                    initialCoords={mapPicker.mode === 'pickup' ? pickupCoords : destCoords}
                    colors={colors}
                    onConfirm={(d) => {
                        if (mapPicker.mode === 'pickup') handlePickupSelect(d);
                        else handleDestSelect(d);
                        setMapPicker(null);
                    }}
                    onClose={() => setMapPicker(null)}
                />
            )}

            {/* ── Driver Search / Accepted Modal ── */}
            <DriverSearchModal
                visible={driverSearchPhase !== 'idle'}
                phase={driverSearchPhase as any}
                driver={foundDriver}
                rideType={rideType}
                passengerCount={passengerCount}
                countdown={countdown}
                pickupLabel={pickupLabel}
                destLabel={destLabel}
                onCancel={cancelDriverSearch}
                onChangeVehicle={() => { cancelDriverSearch(); }}
                onCallDriver={() => Alert.alert('Call Driver', `Calling ${foundDriver?.firstName ?? 'driver'}… (Demo mode)`)}
                colors={colors}
            />



            {/* ── Payment Choice Bottom Sheet ── */}
            <Modal
                visible={!!payModal?.visible}
                transparent
                animationType="slide"
                onRequestClose={handlePayLater}
            >
                <View style={s.pmOverlay}>
                    <View style={[s.pmSheet, { backgroundColor: colors.card }]}>
                        {/* Pull handle */}
                        <View style={[s.pmHandle, { backgroundColor: colors.border }]} />

                        {/* Success icon */}
                        <View style={s.pmSuccessWrap}>
                            <Ionicons name="checkmark-circle" size={56} color="#4CAF50" />
                        </View>
                        <Text style={[s.pmTitle, { color: colors.text }]}>Ride Confirmed!</Text>
                        <Text style={[s.pmSubtitle, { color: colors.subText }]}>
                            Your {meta ? t(meta.key as any, lang) : 'ride'} is on its way
                        </Text>

                        {/* Route summary */}
                        <View style={[s.pmRouteCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                            <View style={s.pmRouteRow}>
                                <View style={[s.pmDot, { backgroundColor: '#4CAF50' }]} />
                                <Text style={[s.pmRouteTxt, { color: colors.text }]} numberOfLines={1}>{pickupLabel}</Text>
                            </View>
                            <View style={[s.pmConnector, { backgroundColor: colors.border }]} />
                            <View style={s.pmRouteRow}>
                                <View style={[s.pmDot, { backgroundColor: '#F44336' }]} />
                                <Text style={[s.pmRouteTxt, { color: colors.text }]} numberOfLines={1}>{destLabel}</Text>
                            </View>
                        </View>

                        {/* Fare + Distance */}
                        <View style={s.pmFareRow}>
                            <View>
                                <Text style={[s.pmFareLabel, { color: colors.subText }]}>Total Fare</Text>
                                <Text style={[s.pmFareAmt, { color: colors.text }]}>{payModal?.fare}</Text>
                            </View>
                            {distanceText && (
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[s.pmFareLabel, { color: colors.subText }]}>Distance</Text>
                                    <Text style={[s.pmFareAmt, { color: colors.text }]}>{distanceText}</Text>
                                </View>
                            )}
                        </View>

                        {/* Pay Now — Razorpay */}
                        <TouchableOpacity
                            style={[s.pmPayNowBtn, payingNow && { opacity: 0.7 }]}
                            onPress={handlePayNow}
                            disabled={payingNow}
                            activeOpacity={0.85}
                        >
                            {payingNow ? (
                                <ActivityIndicator color="#1A1A1A" />
                            ) : (
                                <>
                                    <Ionicons name="flash" size={22} color="#1A1A1A" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.pmPayNowTxt}>Pay Now — {payModal?.fare}</Text>
                                        <Text style={s.pmPayNowSub}>UPI · Cards · Net Banking · Wallets</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#1A1A1A" />
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Pay Later — Cash */}
                        <TouchableOpacity
                            style={[s.pmPayLaterBtn, { borderColor: colors.border }]}
                            onPress={handlePayLater}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="cash-outline" size={20} color={colors.text} />
                            <Text style={[s.pmPayLaterTxt, { color: colors.text }]}>Pay Cash After Drop</Text>
                        </TouchableOpacity>

                        <Text style={[s.pmHint, { color: colors.subText }]}>
                            Pay your driver in cash when you reach the destination
                        </Text>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const makeStyles = (colors: any) => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, backgroundColor: YELLOW,
    },
    backBtn: {
        width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },

    mapWrap: { height: 220, width: SCREEN_W, backgroundColor: '#c8d8e8' },
    mapLoader: {
        position: 'absolute', bottom: 8, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 6,
    },
    mapLoaderTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },

    markerWrap:   { alignItems: 'center' },
    markerCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    markerTail:   { width: 3, height: 9, borderRadius: 2 },

    // Trip / group / schedule badges
    tripBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    tripBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    tripBadgeTxt: { fontSize: 12, fontWeight: '600' },

    // Extra stop dot
    dotOrange: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B00', marginHorizontal: 4 },

    // ── Fellow Travelers card ──────────────────────────────────────────────────
    ftCard: {
        backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16,
        borderWidth: 1.5, borderColor: '#C8E6C9',
        shadowColor: '#2E7D32', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 3,
    },
    ftHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    ftShieldWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
    ftTitle:      { fontSize: 15, fontWeight: '700', color: colors.text },
    ftSubtitle:   { fontSize: 12, color: colors.subText, marginTop: 1 },
    ftTotalPill:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 3 },
    ftTotalNum:   { fontSize: 16, fontWeight: '800', color: '#1565C0' },
    ftTotalLabel: { fontSize: 11, fontWeight: '600', color: '#1565C0' },

    ftAvatarRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 0 },
    ftStackAvatar:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card },
    ftStackAvatarTxt:   { fontSize: 11, fontWeight: '800', color: '#fff' },
    ftAvatarSummary:    { marginLeft: 14, fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },

    ftRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border },
    ftRowDot:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    ftRowDotTxt:   { fontSize: 12, fontWeight: '800', color: '#fff' },
    ftRowInfo:     { flex: 1 },
    ftRowName:     { fontSize: 14, fontWeight: '700', color: colors.text },
    ftRowAreaRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    ftRowArea:     { fontSize: 12, color: colors.subText, fontWeight: '500' },
    ftVerifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
    ftVerifiedTxt:   { fontSize: 11, fontWeight: '600', color: '#2E7D32' },

    ftToggleBtn: { alignItems: 'center', paddingVertical: 8, marginTop: 4 },
    ftToggleTxt: { fontSize: 13, fontWeight: '600', color: '#1565C0' },

    ftPrivacyRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    ftPrivacyTxt: { fontSize: 11, color: colors.subText, flex: 1, lineHeight: 16 },

    scroll: { padding: 16, paddingBottom: 120 },
    ridePill: {
        flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
        borderRadius: 14, padding: 14, marginBottom: 16, gap: 12,
    },
    pillText:  { flex: 1 },
    pillTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    pillSub:   { fontSize: 12, color: colors.subText, marginTop: 2 },

    routeCard: {
        backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 16,
        shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 },
        shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: colors.border,
    },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
    dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4CAF50' },
    dotRed:   { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F44336' },
    routeDivider:   { width: 2, height: 20, backgroundColor: colors.border, marginLeft: 5, marginVertical: 4 },
    routeInputWrap: { flex: 1 },
    routeLabel: { fontSize: 10, color: colors.subText, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
    routeValue: { fontSize: 14, fontWeight: '600' },

    fareCard: { backgroundColor: colors.iconBg, borderRadius: 16, padding: 16, marginBottom: 16, gap: 12 },
    fareRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    fareLabel:{ fontSize: 14, color: colors.subText, fontWeight: '500' },
    fareValue:{ fontSize: 15, fontWeight: '700', color: colors.text },
    payRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },

    confirmWrap: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border,
    },
    confirmBtn: {
        backgroundColor: YELLOW, borderRadius: 14, paddingVertical: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        shadowColor: YELLOW, shadowOpacity: 0.5, shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10, elevation: 5,
    },
    confirmText: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },

    // Driver marker on map
    driverMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2E7D32', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 6 },

    sosFloatBtn: {
        position: 'absolute', top: 12, right: 12,
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: '#D32F2F',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#D32F2F', shadowOpacity: 0.7, shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10, elevation: 10,
        borderWidth: 2, borderColor: '#FF5252',
    },
    sosFloatTxt: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },

    // ── Payment Choice Modal (bottom sheet) ─────────────────────────────────────────
    pmOverlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    pmSheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12,
                    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 28 },
    pmHandle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    pmSuccessWrap:{ alignItems: 'center', marginBottom: 6 },
    pmTitle:      { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
    pmSubtitle:   { fontSize: 14, textAlign: 'center', marginBottom: 20 },
    pmRouteCard:  { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
    pmRouteRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
    pmDot:        { width: 10, height: 10, borderRadius: 5 },
    pmConnector:  { width: 2, height: 14, borderRadius: 1, marginLeft: 4, marginVertical: 3 },
    pmRouteTxt:   { flex: 1, fontSize: 13, fontWeight: '500' },
    pmFareRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
    pmFareLabel:  { fontSize: 12, fontWeight: '500' },
    pmFareAmt:    { fontSize: 24, fontWeight: '800', marginTop: 2 },
    pmPayNowBtn:  { backgroundColor: YELLOW, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16,
                    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
                    shadowColor: YELLOW, shadowOpacity: 0.45, shadowOffset: { width: 0, height: 4 },
                    shadowRadius: 10, elevation: 5 },
    pmPayNowTxt:  { fontSize: 16, fontWeight: '800', color: '#1A1A1A' },
    pmPayNowSub:  { fontSize: 11, color: '#1A1A1A', opacity: 0.6, marginTop: 2 },
    pmPayLaterBtn:{ borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    gap: 10, marginBottom: 14 },
    pmPayLaterTxt:{ fontSize: 15, fontWeight: '600' },
    pmHint:       { textAlign: 'center', fontSize: 12, opacity: 0.65 },
    // Minimized ride bar
    minimizedBar:     { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 8 },
    minimizedBarName: { fontSize: 14, fontWeight: '700', marginBottom: 1 },
    minimizedBarSub:  { fontSize: 12 },
    minimizedEtaBadge:{ alignItems: 'center', backgroundColor: YELLOW, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    minimizedEtaNum:  { fontSize: 16, fontWeight: '900', color: '#1A1A1A' },
    minimizedEtaLbl:  { fontSize: 10, fontWeight: '700', color: '#1A1A1A', marginTop: -2 },
});
